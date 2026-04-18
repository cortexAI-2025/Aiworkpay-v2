import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';

const statusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELED']),
});

const allowedPayworkerTransitions: Record<string, string[]> = {
  ASSIGNED: ['IN_PROGRESS', 'CANCELED'],
  IN_PROGRESS: ['DELIVERED'],
  DELIVERED: [],
  COMPLETED: [],
  CANCELED: [],
};

const PLATFORM_FEE_RATE = 0.1; // 10 %
const PAYWORKER_RATE = 0.9;    // 90 %

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

    if (!isAdmin) {
      const allowed = allowedPayworkerTransitions[mission.status] ?? [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: `Transition "${mission.status}" → "${newStatus}" non autorisée` },
          { status: 409 }
        );
      }
    }

    // ── 90/10 split when mission is COMPLETED ────────────────────────────────
    if (newStatus === 'COMPLETED' && mission.assignedToUserId) {
      const budget = Number(mission.budget);
      const payworkerAmount = parseFloat((budget * PAYWORKER_RATE).toFixed(2));
      const platformFeeAmount = parseFloat((budget * PLATFORM_FEE_RATE).toFixed(2));

      const payworker = await prisma.user.findUnique({
        where: { id: mission.assignedToUserId },
        select: { stripeAccountId: true, stripeAccountOnboarded: true },
      });

      // Update mission with computed amounts
      const updatedMission = await prisma.mission.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          platformFeeAmount,
          payworkerAmount,
        },
      });

      // Record platform fee transaction
      await prisma.transaction.create({
        data: {
          missionId: id,
          userId: mission.assignedToUserId,
          amount: platformFeeAmount,
          currency: mission.currency,
          type: 'PLATFORM_FEE',
          status: 'SUCCEEDED',
          stripePaymentIntentId: mission.stripePaymentIntentId ?? undefined,
        },
      });

      // Payworker payout transaction
      let payoutStatus: 'PENDING' | 'SUCCEEDED' = 'PENDING';
      let stripeTransferId: string | undefined;

      if (payworker?.stripeAccountId && payworker.stripeAccountOnboarded) {
        // Transfer 90 % to payworker's connected Stripe account
        try {
          const transfer = await stripe.transfers.create({
            amount: Math.round(payworkerAmount * 100),
            currency: mission.currency.toLowerCase(),
            destination: payworker.stripeAccountId,
            transfer_group: `mission_${id}`,
            metadata: { missionId: id },
          });
          stripeTransferId = transfer.id;
          payoutStatus = 'SUCCEEDED';
        } catch (transferErr) {
          console.error('Stripe transfer failed:', transferErr);
          // Keep as PENDING — admin can retry
        }
      }

      await prisma.transaction.create({
        data: {
          missionId: id,
          userId: mission.assignedToUserId,
          amount: payworkerAmount,
          currency: mission.currency,
          type: 'PAYWORKER_PAYOUT',
          status: payoutStatus,
          stripePaymentIntentId: mission.stripePaymentIntentId ?? undefined,
          stripeTransferId,
        },
      });

      return NextResponse.json({
        ...updatedMission,
        commission: {
          payworkerAmount,
          platformFeeAmount,
          payworkerRate: '90%',
          platformRate: '10%',
          transferStatus: payoutStatus,
        },
      });
    }

    // ── Cancelation: refund agent if mission not yet assigned ─────────────────
    if (newStatus === 'CANCELED' && mission.status === 'PUBLISHED' && mission.stripePaymentIntentId) {
      try {
        await stripe.refunds.create({
          payment_intent: mission.stripePaymentIntentId,
          reason: 'requested_by_customer',
        });
      } catch (refundErr) {
        console.error('Refund failed:', refundErr);
      }
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
