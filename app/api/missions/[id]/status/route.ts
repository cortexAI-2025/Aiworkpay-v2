import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';

const statusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELED']),
});

const allowedPayworkerTransitions: Record<string, string[]> = {
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['DELIVERED'],
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

    const allowed = (isAdmin ? allowedAdminTransitions : allowedPayworkerTransitions)[mission.status] ?? [];
    if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: `Transition "${mission.status}" → "${newStatus}" non autorisée` },
          { status: 409 }
        );
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

      // Claim completion and create the ledger atomically before calling Stripe.
      const completion = await prisma.$transaction(async (tx) => {
        const completed = await tx.mission.updateMany({
          where: { id, status: 'DELIVERED' },
          data: { status: 'COMPLETED', platformFeeAmount, payworkerAmount },
        });
        if (completed.count !== 1) return null;
        await tx.transaction.create({
          data: {
            missionId: id,
            userId: mission.assignedToUserId!,
            amount: platformFeeAmount,
            currency: mission.currency,
            type: 'PLATFORM_FEE',
            status: 'SUCCEEDED',
            stripePaymentIntentId: mission.stripePaymentIntentId ?? undefined,
          },
        });
        const payout = await tx.transaction.create({
          data: {
            missionId: id,
            userId: mission.assignedToUserId!,
            amount: payworkerAmount,
            currency: mission.currency,
            type: 'PAYWORKER_PAYOUT',
            status: 'PENDING',
            stripePaymentIntentId: mission.stripePaymentIntentId ?? undefined,
          },
        });
        const updatedMission = await tx.mission.findUniqueOrThrow({ where: { id } });
        return { payoutId: payout.id, updatedMission };
      });
      if (!completion) {
        return NextResponse.json({ error: 'La mission a déjà été traitée' }, { status: 409 });
      }

      // Payworker payout transaction
      let payoutStatus: 'PENDING' | 'SUCCEEDED' = 'PENDING';
      let stripeTransferId: string | undefined;

      if (payworker?.stripeAccountId && payworker.stripeAccountOnboarded) {
        // Transfer 90 % to payworker's connected Stripe account
        try {
          const transfer = await stripe.transfers.create(
            {
              amount: Math.round(payworkerAmount * 100),
              currency: mission.currency.toLowerCase(),
              destination: payworker.stripeAccountId,
              transfer_group: `mission_${id}`,
              metadata: { missionId: id },
            },
            { idempotencyKey: `mission_payout_${id}` }
          );
          stripeTransferId = transfer.id;
          payoutStatus = 'SUCCEEDED';
        } catch (transferErr) {
          console.error('Stripe transfer failed:', transferErr);
          // Keep as PENDING — admin can retry
        }
      }

      await prisma.transaction.update({
        where: { id: completion.payoutId },
        data: { status: payoutStatus, stripeTransferId },
      });

      return NextResponse.json({
        ...completion.updatedMission,
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
    if (newStatus === 'CANCELED' && mission.stripePaymentIntentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(mission.stripePaymentIntentId);
        if (paymentIntent.status === 'succeeded') {
          await stripe.refunds.create({
            payment_intent: mission.stripePaymentIntentId,
            reason: 'requested_by_customer',
          }, { idempotencyKey: `mission_refund_${id}` });
        } else if (!['canceled', 'requires_payment_method'].includes(paymentIntent.status)) {
          await stripe.paymentIntents.cancel(mission.stripePaymentIntentId, {}, {
            idempotencyKey: `mission_cancel_${id}`,
          });
        }
      } catch (refundErr) {
        console.error('Refund failed:', refundErr);
        return NextResponse.json(
          { error: 'Le remboursement a échoué ; la mission n\'a pas été annulée' },
          { status: 502 }
        );
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
