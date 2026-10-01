import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { apiError, authenticateAgent, findOwnedMission, readOptionalJson } from '@/lib/agentApi';
import { MAX_REVISIONS } from '@/lib/missionLifecycle';

const requestChangesSchema = z.object({
  // What is missing or wrong, shown to the Payworker
  feedback: z.string().trim().min(10).max(5000),
});

/**
 * The agent sends a delivery back to the same Payworker with feedback:
 * DELIVERED → IN_PROGRESS. No money moves. Limited to MAX_REVISIONS rounds, so
 * that a Payworker cannot be kept working forever without being paid.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { apiKey, response } = await authenticateAgent(request, 'missions:approve');
    if (response) return response;

    const { id } = await params;
    const mission = await findOwnedMission(apiKey, id);
    if (!mission) return apiError('MISSION_NOT_FOUND', 'Mission introuvable', 404);

    const json = await readOptionalJson(request);
    if (!json.ok) return apiError('INVALID_JSON', 'Corps JSON invalide', 400);
    const parsed = requestChangesSchema.safeParse(json.body);
    if (!parsed.success) {
      return apiError('INVALID_BODY', 'Données invalides', 400, parsed.error.flatten());
    }

    if (mission.status !== 'DELIVERED') {
      return apiError(
        'MISSION_NOT_DELIVERED',
        `Seule une mission livrée peut être renvoyée au Payworker (statut actuel : ${mission.status})`,
        409,
        { status: mission.status }
      );
    }
    if (mission.revisionCount >= MAX_REVISIONS) {
      return apiError(
        'REVISION_LIMIT_REACHED',
        `Cette mission a déjà été renvoyée ${MAX_REVISIONS} fois : validez-la ou contactez l'équipe AIWorkPay`,
        409,
        { maxRevisions: MAX_REVISIONS }
      );
    }

    const claimed = await prisma.mission.updateMany({
      where: { id, status: 'DELIVERED', revisionCount: mission.revisionCount },
      data: {
        status: 'IN_PROGRESS',
        revisionFeedback: parsed.data.feedback,
        revisionCount: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      return apiError('MISSION_CHANGED', 'La mission a changé entre-temps ; relisez-la', 409);
    }

    const updated = await prisma.mission.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({
      mission: updated,
      revisionsLeft: MAX_REVISIONS - updated.revisionCount,
    });
  } catch (error) {
    console.error('Agent request-changes error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}
