import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { MissionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { cancelMission, completeDeliveredMission } from '@/lib/missionLifecycle';

const statusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELED']),
});

// IN_PROGRESS → DELIVERED goes through POST /api/missions/{id}/deliver, which
// records the result the agent is waiting for.
const allowedPayworkerTransitions: Record<string, string[]> = {
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: [],
  DELIVERED: [],
  COMPLETED: [],
  CANCELED: [],
};

const allowedAdminTransitions: Record<string, string[]> = {
  PAYMENT_PENDING: ['CANCELED'],
  PUBLISHED: ['CANCELED'],
  ASSIGNED: ['CANCELED'],
  IN_PROGRESS: ['CANCELED'],
  DELIVERED: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
};

const ADMIN_CANCELABLE = Object.entries(allowedAdminTransitions)
  .filter(([, targets]) => targets.includes('CANCELED'))
  .map(([status]) => status as MissionStatus);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const { status: newStatus } = parsed.data;
    const isAdmin = session.user.role === 'ADMIN';

    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }

    const isAssignee = mission.assignedToUserId === session.user.id;
    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const allowed = (isAdmin ? allowedAdminTransitions : allowedPayworkerTransitions)[mission.status] ?? [];
    if (!isAdmin && mission.status === 'IN_PROGRESS' && newStatus === 'DELIVERED') {
      return NextResponse.json(
        { error: 'Livrez la mission avec son résultat via POST /api/missions/{id}/deliver' },
        { status: 409 }
      );
    }
    if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: `Transition "${mission.status}" → "${newStatus}" non autorisée` },
          { status: 409 }
        );
    }

    // ── 90/10 split when mission is COMPLETED ────────────────────────────────
    if (newStatus === 'COMPLETED' && mission.assignedToUserId) {
      const completion = await completeDeliveredMission(mission);
      if (!completion) {
        return NextResponse.json({ error: 'La mission a déjà été traitée' }, { status: 409 });
      }
      return NextResponse.json({ ...completion.mission, commission: completion.commission });
    }

    // ── Cancelation: refund the agent ─────────────────────────────────────────
    if (newStatus === 'CANCELED') {
      const outcome = await cancelMission(mission, ADMIN_CANCELABLE);
      if (!outcome.ok) {
        return outcome.reason === 'REFUND_FAILED'
          ? NextResponse.json({ error: 'Le remboursement a échoué ; la mission n\'a pas été annulée' }, { status: 502 })
          : NextResponse.json({ error: 'La mission a changé entre-temps ; réessayez' }, { status: 409 });
      }
      return NextResponse.json(outcome.mission);
    }

    const updated = await prisma.mission.update({
      where: { id },
      data: { status: newStatus },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
