import type { Mission, MissionStatus } from '@prisma/client';
import { prisma } from './prisma';
import { stripe } from './stripe';
import { releaseMissionPayment } from './missionPayment';

const PLATFORM_FEE_RATE = 0.1; // 10 %
const PAYWORKER_RATE = 0.9; // 90 %

/** A delivered mission can be sent back to its Payworker at most this many times. */
export const MAX_REVISIONS = 3;

export interface Completion {
  mission: Mission;
  commission: {
    payworkerAmount: number;
    platformFeeAmount: number;
    payworkerRate: '90%';
    platformRate: '10%';
    transferStatus: 'PENDING' | 'SUCCEEDED';
  };
}

/**
 * DELIVERED → COMPLETED: book the 90/10 split, then transfer the Payworker's
 * share to its Stripe Connect account. Returns null when the mission is not (or
 * no longer) DELIVERED — the compare-and-set makes a double validation pay once.
 */
export async function completeDeliveredMission(mission: Mission): Promise<Completion | null> {
  const id = mission.id;
  const payworkerId = mission.assignedToUserId;
  if (!payworkerId) return null;

  const budget = Number(mission.budget);
  const payworkerAmount = parseFloat((budget * PAYWORKER_RATE).toFixed(2));
  const platformFeeAmount = parseFloat((budget * PLATFORM_FEE_RATE).toFixed(2));

  const payworker = await prisma.user.findUnique({
    where: { id: payworkerId },
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
        userId: payworkerId,
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
        userId: payworkerId,
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
  if (!completion) return null;

  // Payworker payout transaction
  let transferStatus: 'PENDING' | 'SUCCEEDED' = 'PENDING';
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
      transferStatus = 'SUCCEEDED';
    } catch (transferErr) {
      console.error('Stripe transfer failed:', transferErr);
      // Keep as PENDING — admin can retry
    }
  }

  await prisma.transaction.update({
    where: { id: completion.payoutId },
    data: { status: transferStatus, stripeTransferId },
  });

  return {
    mission: completion.updatedMission,
    commission: { payworkerAmount, platformFeeAmount, payworkerRate: '90%', platformRate: '10%', transferStatus },
  };
}

export type CancelOutcome =
  | { ok: true; mission: Mission; payment: Awaited<ReturnType<typeof releaseMissionPayment>> }
  | { ok: false; reason: 'NOT_CANCELABLE'; status: MissionStatus }
  | { ok: false; reason: 'REFUND_FAILED' };

/**
 * Cancel a mission and give the money back. The mission is claimed first
 * (compare-and-set on its current status), so that a Payworker cannot accept
 * it while it is being refunded; if Stripe then fails, the claim is undone and
 * nothing changed.
 */
export async function cancelMission(mission: Mission, allowedFrom: readonly MissionStatus[]): Promise<CancelOutcome> {
  if (!allowedFrom.includes(mission.status)) {
    return { ok: false, reason: 'NOT_CANCELABLE', status: mission.status };
  }

  const claimed = await prisma.mission.updateMany({
    where: { id: mission.id, status: mission.status },
    data: { status: 'CANCELED' },
  });
  if (claimed.count !== 1) {
    const current = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id }, select: { status: true } });
    return { ok: false, reason: 'NOT_CANCELABLE', status: current.status };
  }

  try {
    const payment = await releaseMissionPayment(mission);
    const canceled = await prisma.mission.findUniqueOrThrow({ where: { id: mission.id } });
    return { ok: true, mission: canceled, payment };
  } catch (refundErr) {
    console.error('Refund failed:', refundErr);
    await prisma.mission.updateMany({
      where: { id: mission.id, status: 'CANCELED' },
      data: { status: mission.status },
    });
    return { ok: false, reason: 'REFUND_FAILED' };
  }
}
