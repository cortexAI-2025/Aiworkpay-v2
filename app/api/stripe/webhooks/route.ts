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
      case 'checkout.session.completed': {
        const checkoutSession = event.data.object as Stripe.Checkout.Session;
        if (checkoutSession.mode === 'subscription') {
          await handleSubscriptionCreated(checkoutSession);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentSucceeded(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
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

async function handleSubscriptionCreated(checkoutSession: Stripe.Checkout.Session) {
  const userId = checkoutSession.metadata?.userId;
  if (!userId) return;

  const subscriptionId = checkoutSession.subscription as string;
  const customerId = checkoutSession.customer as string;

  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        status: stripeSubscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
      update: {
        status: stripeSubscription.status === 'active' ? 'ACTIVE' : 'INACTIVE',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    }),
    prisma.transaction.create({
      data: {
        userId,
        amount: (checkoutSession.amount_total || 1000) / 100,
        currency: (checkoutSession.currency || 'eur').toUpperCase(),
        type: 'SUBSCRIPTION',
        status: 'SUCCEEDED',
        stripePaymentIntentId: checkoutSession.payment_intent as string | undefined,
      },
    }),
  ]);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!user) return;

  let status: 'ACTIVE' | 'INACTIVE' | 'CANCELED' = 'INACTIVE';
  if (subscription.status === 'active') status = 'ACTIVE';
  else if (subscription.status === 'canceled') status = 'CANCELED';

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
    update: {
      status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!user) return;

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { status: 'CANCELED' },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeSubscriptionId: null },
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!invoice.customer || !invoice.subscription) return;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
  });

  if (!user) return;

  await prisma.subscription.updateMany({
    where: { userId: user.id },
    data: { status: 'ACTIVE' },
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.customer) return;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: invoice.customer as string },
  });

  if (!user) return;

  await prisma.subscription.updateMany({
    where: { userId: user.id },
    data: { status: 'INACTIVE' },
  });
}
