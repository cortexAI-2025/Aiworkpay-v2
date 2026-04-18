import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET non configuré' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Agent pays for a mission ──────────────────────────────────────────
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleMissionPaymentSucceeded(pi);
        break;
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleMissionPaymentFailed(pi);
        break;
      }

      // ── Connect: payout to Payworker confirmed ────────────────────────────
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(transfer);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleMissionPaymentSucceeded(pi: Stripe.PaymentIntent) {
  const missionId = pi.metadata?.missionId;
  if (!missionId) return;

  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission || mission.status !== 'PAYMENT_PENDING') return;

  // Publish the mission — payment confirmed
  await prisma.mission.update({
    where: { id: missionId },
    data: { status: 'PUBLISHED' },
  });

  // Determine which user to associate with the AGENT_PAYMENT transaction.
  // Use the creator user if available, otherwise find via apiKey owner.
  let userId = mission.createdByUserId;
  if (!userId && mission.createdByApiKeyId) {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: mission.createdByApiKeyId },
      select: { createdByUserId: true },
    });
    userId = apiKey?.createdByUserId ?? null;
  }

  // Only create a transaction when we have a traceable user
  if (userId) {
    await prisma.transaction.create({
      data: {
        missionId,
        userId,
        amount: pi.amount / 100,
        currency: pi.currency.toUpperCase(),
        type: 'AGENT_PAYMENT',
        status: 'SUCCEEDED',
        stripePaymentIntentId: pi.id,
        stripeChargeId: typeof pi.latest_charge === 'string' ? pi.latest_charge : undefined,
      },
    });
  }
}

async function handleMissionPaymentFailed(pi: Stripe.PaymentIntent) {
  const missionId = pi.metadata?.missionId;
  if (!missionId) return;

  await prisma.mission.update({
    where: { id: missionId },
    data: { status: 'CANCELED' },
  });
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  const missionId = transfer.metadata?.missionId;
  if (!missionId) return;

  // Mark the PAYWORKER_PAYOUT transaction as SUCCEEDED when we have a transfer ID
  await prisma.transaction.updateMany({
    where: {
      missionId,
      type: 'PAYWORKER_PAYOUT',
      status: 'PENDING',
    },
    data: {
      status: 'SUCCEEDED',
      stripeTransferId: transfer.id,
    },
  });
}
