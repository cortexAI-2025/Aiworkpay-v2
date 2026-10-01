import type Stripe from 'stripe';
import type { Mission } from '@prisma/client';
import { stripe } from './stripe';

/**
 * How an agent pays for a mission. The mission is published only once Stripe
 * confirms the payment (`payment_intent.succeeded` webhook), whatever the mode.
 *
 * - `checkout`: a hosted Stripe Checkout page. The agent hands the URL to a
 *   human (its owner), who pays: no money moves without a person approving it.
 * - `payment_intent`: the historical flow. The agent confirms the returned
 *   `clientSecret` itself, or passes `paymentMethodId` to be charged at once.
 */
export type PaymentMode = 'checkout' | 'payment_intent';

export type MissionPayment =
  | {
      mode: 'checkout';
      checkoutSessionId: string;
      url: string | null;
      expiresAt: string | null;
    }
  | {
      mode: 'payment_intent';
      paymentIntentId: string;
      clientSecret: string | null;
      status: Stripe.PaymentIntent.Status;
    };

type PayableMission = Pick<Mission, 'id' | 'title' | 'budget' | 'currency'>;

function amountInCents(mission: PayableMission): number {
  return Math.round(Number(mission.budget) * 100);
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function startCheckout(
  mission: PayableMission,
  customerId: string,
  apiKeyId: string
): Promise<Extract<MissionPayment, { mode: 'checkout' }>> {
  const metadata = { missionId: mission.id, apiKeyId };
  const missionUrl = `${appUrl()}/dashboard/missions/${mission.id}`;

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      customer: customerId,
      client_reference_id: mission.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: mission.currency.toLowerCase(),
            unit_amount: amountInCents(mission),
            product_data: { name: `Mission : ${mission.title}` },
          },
        },
      ],
      // The webhook publishes the mission from the PaymentIntent's metadata,
      // exactly as for the payment_intent mode.
      payment_intent_data: { metadata, description: `Mission: ${mission.title}` },
      metadata,
      success_url: `${missionUrl}?payment=success`,
      cancel_url: `${missionUrl}?payment=canceled`,
    },
    { idempotencyKey: `mission_checkout_${mission.id}` }
  );

  return {
    mode: 'checkout',
    checkoutSessionId: session.id,
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
  };
}

export async function startPaymentIntent(
  mission: PayableMission,
  customerId: string,
  apiKeyId: string,
  paymentMethodId?: string
): Promise<Extract<MissionPayment, { mode: 'payment_intent' }>> {
  const params: Stripe.PaymentIntentCreateParams = {
    amount: amountInCents(mission),
    currency: mission.currency.toLowerCase(),
    customer: customerId,
    metadata: { missionId: mission.id, apiKeyId },
    description: `Mission: ${mission.title}`,
  };

  // If the agent provides a payment method, confirm immediately
  if (paymentMethodId) {
    params.payment_method = paymentMethodId;
    params.confirm = true;
    params.return_url = `${appUrl()}/dashboard/missions/${mission.id}`;
  } else {
    params.automatic_payment_methods = { enabled: true };
  }

  const paymentIntent = await stripe.paymentIntents.create(params, {
    idempotencyKey: `mission_payment_intent_${mission.id}`,
  });

  return {
    mode: 'payment_intent',
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
    status: paymentIntent.status,
  };
}

/** Payment details of an existing mission, e.g. to answer a retried creation. */
export async function describePayment(
  mission: Pick<Mission, 'stripeCheckoutSessionId' | 'checkoutUrl' | 'checkoutExpiresAt' | 'stripePaymentIntentId'>
): Promise<MissionPayment | null> {
  if (mission.stripeCheckoutSessionId) {
    return {
      mode: 'checkout',
      checkoutSessionId: mission.stripeCheckoutSessionId,
      url: mission.checkoutUrl,
      expiresAt: mission.checkoutExpiresAt?.toISOString() ?? null,
    };
  }
  if (mission.stripePaymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(mission.stripePaymentIntentId);
    return {
      mode: 'payment_intent',
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: paymentIntent.status,
    };
  }
  return null;
}

/** What releasing a mission's payment did. */
export type PaymentRelease = 'checkout_closed' | 'refunded' | 'payment_canceled' | 'nothing_to_release';

/**
 * Undo whatever the agent paid, or close the payment still open, before a
 * mission is canceled. Throws if Stripe refuses: the caller must then keep the
 * mission as it is.
 */
export async function releaseMissionPayment(
  mission: Pick<Mission, 'id' | 'stripePaymentIntentId' | 'stripeCheckoutSessionId'>
): Promise<PaymentRelease> {
  let paymentIntentId = mission.stripePaymentIntentId;

  if (!paymentIntentId && mission.stripeCheckoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(mission.stripeCheckoutSessionId);
    if (session.status === 'open') {
      // Nobody has paid yet: close the page so it can no longer be paid.
      await stripe.checkout.sessions.expire(mission.stripeCheckoutSessionId, {}, {
        idempotencyKey: `mission_checkout_expire_${mission.id}`,
      });
      return 'checkout_closed';
    }
    paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  }

  if (!paymentIntentId) return 'nothing_to_release';

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.status === 'succeeded') {
    await stripe.refunds.create(
      { payment_intent: paymentIntentId, reason: 'requested_by_customer' },
      { idempotencyKey: `mission_refund_${mission.id}` }
    );
    return 'refunded';
  }
  if (!['canceled', 'requires_payment_method'].includes(paymentIntent.status)) {
    await stripe.paymentIntents.cancel(paymentIntentId, {}, {
      idempotencyKey: `mission_cancel_${mission.id}`,
    });
    return 'payment_canceled';
  }
  return 'nothing_to_release';
}
