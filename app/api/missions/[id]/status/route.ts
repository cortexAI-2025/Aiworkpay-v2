import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

const statusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELED']),
});

const allowedTransitions: Record<string, string[]> = {
  ASSIGNED: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['DELIVERED', 'CANCELED'],
  DELIVERED: ['COMPLETED', 'IN_PROGRESS'],
  COMPLETED: [],
  CANCELED: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = statusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const { status: newStatus } = parsed.data;

    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }

    // Only assignee or admin can update status
    const isAdmin = session.role === 'ADMIN';
    const isAssignee = mission.assignedToUserId === session.sub;

    if (!isAdmin && !isAssignee) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Admin can complete / any valid transition
    if (!isAdmin) {
      const allowed = allowedTransitions[mission.status] || [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: `Transition de "${mission.status}" vers "${newStatus}" non autorisée` },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.mission.update({
      where: { id },
      data: { status: newStatus },
    });

    // If mission is COMPLETED, create a simulated payout transaction
    if (newStatus === 'COMPLETED' && mission.assignedToUserId) {
      await prisma.transaction.create({
        data: {
          missionId: id,
          userId: mission.assignedToUserId,
          amount: mission.budget,
          currency: mission.currency,
          type: 'MISSION_PAYOUT',
          status: 'PENDING',
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
