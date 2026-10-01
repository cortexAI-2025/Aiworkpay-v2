import { NextRequest, NextResponse } from 'next/server';
import type { MissionStatus } from '@prisma/client';
import { apiError, authenticateAgent, findOwnedMission } from '@/lib/agentApi';
import { cancelMission } from '@/lib/missionLifecycle';

/**
 * An agent cancels its own mission as long as no Payworker has taken it:
 * an unpaid Checkout page is closed, a paid mission is refunded. Once a
 * Payworker is engaged, only an admin can cancel.
 */
const AGENT_CANCELABLE: readonly MissionStatus[] = ['PAYMENT_PENDING', 'PUBLISHED'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { apiKey, response } = await authenticateAgent(request, 'missions:write');
    if (response) return response;

    const { id } = await params;
    const mission = await findOwnedMission(apiKey, id);
    if (!mission) return apiError('MISSION_NOT_FOUND', 'Mission introuvable', 404);

    // Canceling twice is not an error: the agent may be retrying.
    if (mission.status === 'CANCELED') {
      return NextResponse.json({ mission, payment: 'already_canceled' });
    }

    const outcome = await cancelMission(mission, AGENT_CANCELABLE);
    if (!outcome.ok) {
      return outcome.reason === 'REFUND_FAILED'
        ? apiError('REFUND_FAILED', 'Le remboursement a échoué ; la mission n\'a pas été annulée. Réessayez.', 502)
        : apiError(
            'MISSION_NOT_CANCELABLE',
            `Un Payworker est déjà engagé (statut ${outcome.status}) : seule l'équipe AIWorkPay peut annuler cette mission`,
            409,
            { status: outcome.status }
          );
    }

    return NextResponse.json({ mission: outcome.mission, payment: outcome.payment });
  } catch (error) {
    console.error('Agent cancel error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}
