import type { Mission, MissionStatus } from '@prisma/client';
import { prisma } from './prisma';
import { stripe } from './stripe';
import { releaseMissionPayment } from './missionPayment';

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
  const platformFeeAmount = Math.round((budget - payworkerAmount) * 100) / 100;



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

  const payout = await retryMissionPayout(id);
  const transferStatus = payout.status;

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


/** Retry a booked payout without creating another ledger entry or Stripe transfer. */
export async function retryMissionPayout(missionId: string): Promise<{ status: 'PENDING' | 'SUCCEEDED'; reason?: string }> {
  const payout = await prisma.transaction.findFirst({
    where: { missionId, type: 'PAYWORKER_PAYOUT' },
    include: { user: { select: { stripeAccountId: true, stripeAccountOnboarded: true } }, mission: true },
  });
  if (!payout || payout.mission?.status !== 'COMPLETED') throw new Error('PAYOUT_NOT_READY');
  if (payout.status === 'SUCCEEDED') return { status: 'SUCCEEDED' };
  if (!payout.user.stripeAccountId || !payout.user.stripeAccountOnboarded) return { status: 'PENDING', reason: 'CONNECT_NOT_READY' };
  try {
    // Stripe may expire idempotency keys after 24 hours. Reconcile a successful
    // transfer before retrying an old or uncertain outcome.
    const previous = await stripe.transfers.list({ transfer_group: `mission_${missionId}`, limit: 100 });
    const existing = previous.data.find(t => t.metadata.missionId === missionId);
    if (existing) {
      if (existing.reversed || existing.amount !== Math.round(Number(payout.amount) * 100) || existing.currency !== payout.currency.toLowerCase()) {
        return { status: 'PENDING', reason: 'TRANSFER_RECONCILIATION_REQUIRED' };
      }
      await prisma.transaction.update({ where: { id: payout.id }, data: { status: 'SUCCEEDED', stripeTransferId: existing.id } });
      return { status: 'SUCCEEDED' };
    }
    const transfer = await stripe.transfers.create({
      amount: Math.round(Number(payout.amount) * 100),
      currency: payout.currency.toLowerCase(),
      destination: payout.user.stripeAccountId,
      transfer_group: `mission_${missionId}`,
      metadata: { missionId },
    }, { idempotencyKey: `mission_payout_${missionId}` });
    await prisma.transaction.update({ where: { id: payout.id }, data: { status: 'SUCCEEDED', stripeTransferId: transfer.id } });
    return { status: 'SUCCEEDED' };
  } catch (error) {
    // Keep the booked payout pending, including when the network outcome is uncertain.
    console.error(`Payout transfer failed for mission ${missionId}:`, error);
    return { status: 'PENDING', reason: 'TRANSFER_UNAVAILABLE' };
  }
}
