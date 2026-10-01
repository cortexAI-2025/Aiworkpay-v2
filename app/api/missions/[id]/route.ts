import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, authenticateAgent } from '@/lib/agentApi';
import { missionForAgent } from '@/lib/missionView';

/**
 * Read one mission with its API key. An agent only sees the missions created
 * with its own key; any other id answers 404, so that an unrelated mission
 * cannot be told apart from a nonexistent one.
 *
 * Once the mission is DELIVERED, `resultNote`, `resultData`, `deliveredAt` and
 * the attachments of kind PROOF carry the Payworker's result; uploaded files
 * (`source: "upload"`) are downloaded from their `url` with the same API key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { apiKey, response } = await authenticateAgent(request, 'missions:read');
    if (response) return response;

    const { id } = await params;

    const mission = await prisma.mission.findFirst({
      where: { id, createdByApiKeyId: apiKey.id },
      include: { attachments: { orderBy: { createdAt: 'asc' } } },
    });

    if (!mission) return apiError('MISSION_NOT_FOUND', 'Mission introuvable', 404);

    return NextResponse.json(missionForAgent(mission));
  } catch (error) {
    console.error('Get mission error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}
