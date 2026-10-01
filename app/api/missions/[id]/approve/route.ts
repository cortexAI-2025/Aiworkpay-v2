import { NextRequest, NextResponse } from 'next/server';
import { apiError, authenticateAgent, findOwnedMission } from '@/lib/agentApi';
import { completeDeliveredMission } from '@/lib/missionLifecycle';

/**
 * The agent accepts the delivered result: DELIVERED → COMPLETED, which pays
 * the Payworker (90 %) and books AIWORKPAY's fee (10 %).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { apiKey, response } = await authenticateAgent(request);
    if (response) return response;

    const { id } = await params;
    const mission = await findOwnedMission(apiKey, id);
    if (!mission) return apiError('MISSION_NOT_FOUND', 'Mission introuvable', 404);

    // Approving twice is not an error: the agent may be retrying.
    if (mission.status === 'COMPLETED') {
      return NextResponse.json({ mission, alreadyApproved: true });
    }
    if (mission.status !== 'DELIVERED') {
      return apiError(
        'MISSION_NOT_DELIVERED',
        `Seule une mission livrée peut être validée (statut actuel : ${mission.status})`,
        409,
        { status: mission.status }
      );
    }

    const completion = await completeDeliveredMission(mission);
    if (!completion) {
      return apiError('MISSION_CHANGED', 'La mission a changé entre-temps ; relisez-la', 409);
    }

    return NextResponse.json({ mission: completion.mission, commission: completion.commission, alreadyApproved: false });
  } catch (error) {
    console.error('Agent approve error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}
