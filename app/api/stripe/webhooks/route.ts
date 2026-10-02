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

  // Platform events and Connect (connected accounts) events are sent by two
  // distinct Stripe endpoints, each with its own signing secret.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .filter((s): s is string => !!s);
  if (secrets.length === 0) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET non configuré' }, { status: 500 });
  }

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, secret);
      break;
    } catch {
      // try the next secret
    }
  }
  if (!event) {
    console.error('Webhook signature verification failed');
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

      // ── Checkout page left unpaid until it expired ────────────────────────
      case 'checkout.session.expired': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutExpired(checkoutSession);
        break;
      }

      // ── Connect: payout to Payworker confirmed ────────────────────────────
      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(transfer);
        break;
      }

      // ── Connect: Payworker account capabilities changed ───────────────────
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdated(account);
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

  // Commit publication and its ledger entry together. A failed ledger write
  // rolls back the claim so Stripe can safely retry the event.
  const canceled = await prisma.$transaction(async (tx) => {
    const { count } = await tx.mission.updateMany({
      where: { id: missionId, status: 'PAYMENT_PENDING' },
      data: { status: 'PUBLISHED', stripePaymentIntentId: pi.id },
    });
    if (count === 0) {
      const mission = await tx.mission.findUnique({
        where: { id: missionId }, select: { status: true },
      });
      return mission?.status === 'CANCELED';
    }

    // Determine which user to associate with the AGENT_PAYMENT transaction.
    const mission = await tx.mission.findUnique({
      where: { id: missionId },
      select: { createdByUserId: true, createdByApiKeyId: true },
    });
  
    let userId = mission?.createdByUserId ?? null;
    if (!userId && mission?.createdByApiKeyId) {
      const apiKey = await tx.apiKey.findUnique({
        where: { id: mission.createdByApiKeyId },
        select: { createdByUserId: true },
      });
      userId = apiKey?.createdByUserId ?? null;
    }
  
    if (userId) {
      await tx.transaction.create({
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
    return false;
  });

  // External network calls must stay outside the database transaction.
  if (canceled) {
    await stripe.refunds.create(
      { payment_intent: pi.id, reason: 'requested_by_customer' },
      { idempotencyKey: `mission_refund_${missionId}` }
    );
  }
}

async function handleMissionPaymentFailed(pi: Stripe.PaymentIntent) {
  const missionId = pi.metadata?.missionId;
  if (!missionId) return;

  // On a Checkout page the payer can try another card: the page stays open
  // until it expires (checkout.session.expired).
  await prisma.mission.updateMany({
    where: { id: missionId, status: 'PAYMENT_PENDING', stripeCheckoutSessionId: null },
    data: { status: 'CANCELED' },
  });
}

async function handleCheckoutExpired(checkoutSession: Stripe.Checkout.Session) {
  // Only a mission still waiting for this very page is canceled.
  await prisma.mission.updateMany({
    where: { stripeCheckoutSessionId: checkoutSession.id, status: 'PAYMENT_PENDING' },
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

async function handleAccountUpdated(account: Stripe.Account) {
  const onboarded = !!account.details_submitted && account.capabilities?.transfers === 'active';
  const { count } = await prisma.user.updateMany({
    where: { stripeAccountId: account.id, stripeAccountOnboarded: !onboarded },
    data: { stripeAccountOnboarded: onboarded },
  });
  if (count > 0 && !onboarded) {
    console.warn(`Connect account ${account.id} can no longer receive transfers`);
  }
}
