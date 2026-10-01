import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MissionStatus, Prisma, type ApiKey, type Mission } from '@prisma/client';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/apikey';
import { stripe } from '@/lib/stripe';
import { auth } from '@/auth';
import {
  apiError,
  authenticateAgent,
  extractApiKey,
  fingerprint,
  readIdempotencyKey,
} from '@/lib/agentApi';
import {
  describePayment,
  startCheckout,
  startPaymentIntent,
  type MissionPayment,
} from '@/lib/missionPayment';

const createMissionSchema = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().min(10),
    budget: z.number().positive(),
    currency: z.string().length(3).default('EUR'),
    deadline: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .refine((val) => new Date(val) > new Date(), { message: 'La date limite doit être dans le futur' }),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    // `checkout`: a hosted payment page for a human to pay.
    // `payment_intent` (default): the agent confirms the payment itself.
    paymentMode: z.enum(['checkout', 'payment_intent']).default('payment_intent'),
    // Optionally provide a Stripe payment_method_id for immediate charge
    paymentMethodId: z.string().optional(),
  })
  .refine((data) => !(data.paymentMode === 'checkout' && data.paymentMethodId), {
    message: '`paymentMethodId` est incompatible avec `paymentMode: "checkout"`',
    path: ['paymentMethodId'],
  });

type CreateMissionInput = z.infer<typeof createMissionSchema>;

export async function POST(request: NextRequest) {
  try {
    const { apiKey, response } = await authenticateAgent(request);
    if (response) return response;

    const idempotencyKey = readIdempotencyKey(request);
    if (idempotencyKey === null) {
      return apiError(
        'INVALID_IDEMPOTENCY_KEY',
        'En-tête Idempotency-Key invalide : 8 à 255 caractères parmi A-Z a-z 0-9 _ . : -',
        400
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps JSON invalide', 400);
    }

    const parsed = createMissionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_BODY', 'Données invalides', 400, parsed.error.flatten());
    }

    const input = parsed.data;
    const requestFingerprint = fingerprint(input);

    // A retried request returns the mission created by the first one.
    if (idempotencyKey) {
      const existing = await prisma.mission.findUnique({
        where: { createdByApiKeyId_idempotencyKey: { createdByApiKeyId: apiKey.id, idempotencyKey } },
      });
      if (existing) return await replay(existing, requestFingerprint, apiKey, input);
    }

    const customerId = await ensureStripeCustomer(apiKey);

    // Create mission first
    let mission: Mission;
    try {
      mission = await prisma.mission.create({
        data: {
          title: input.title,
          description: input.description,
          budget: input.budget,
          currency: input.currency.toUpperCase(),
          deadline: new Date(input.deadline),
          priority: input.priority,
          status: 'PAYMENT_PENDING',
          createdByApiKeyId: apiKey.id,
          idempotencyKey: idempotencyKey ?? null,
          idempotencyFingerprint: idempotencyKey ? requestFingerprint : null,
        },
      });
    } catch (error) {
      // Two concurrent requests with the same Idempotency-Key: the other one won.
      if (idempotencyKey && isUniqueViolation(error)) {
        const existing = await prisma.mission.findUniqueOrThrow({
          where: { createdByApiKeyId_idempotencyKey: { createdByApiKeyId: apiKey.id, idempotencyKey } },
        });
        return await replay(existing, requestFingerprint, apiKey, input);
      }
      throw error;
    }

    return await attachPayment(mission, customerId, apiKey, input, 201);
  } catch (error) {
    console.error('Create mission error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}

async function ensureStripeCustomer(apiKey: ApiKey): Promise<string> {
  // Each API key (agent) has its own Stripe customer
  if (apiKey.stripeCustomerId) return apiKey.stripeCustomerId;

  const customer = await stripe.customers.create(
    { description: apiKey.label, metadata: { apiKeyId: apiKey.id } },
    { idempotencyKey: `apikey_customer_${apiKey.id}` }
  );
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/**
 * Open the payment of a mission still awaiting it, record it on the mission,
 * and answer with both. The Stripe calls carry an idempotency key derived from
 * the mission id, so resuming after an uncertain failure never pays twice.
 */
async function attachPayment(
  mission: Mission,
  customerId: string,
  apiKey: ApiKey,
  input: CreateMissionInput,
  status: 200 | 201
): Promise<NextResponse> {
  let payment: MissionPayment;
  try {
    payment =
      input.paymentMode === 'checkout'
        ? await startCheckout(mission, customerId, apiKey.id)
        : await startPaymentIntent(mission, customerId, apiKey.id, input.paymentMethodId);
  } catch (error) {
    return paymentFailure(mission, error);
  }

  const updated = await prisma.mission.update({
    where: { id: mission.id },
    data:
      payment.mode === 'checkout'
        ? {
            stripeCheckoutSessionId: payment.checkoutSessionId,
            checkoutUrl: payment.url,
            checkoutExpiresAt: payment.expiresAt ? new Date(payment.expiresAt) : null,
          }
        : { stripePaymentIntentId: payment.paymentIntentId },
  });

  return NextResponse.json(
    { mission: updated, payment },
    { status, headers: status === 200 ? { 'Idempotent-Replayed': 'true' } : undefined }
  );
}

async function replay(
  existing: Mission,
  requestFingerprint: string,
  apiKey: ApiKey,
  input: CreateMissionInput
): Promise<NextResponse> {
  if (existing.idempotencyFingerprint !== requestFingerprint) {
    return apiError(
      'IDEMPOTENCY_KEY_REUSED',
      'Cette Idempotency-Key a déjà servi pour une requête différente',
      422
    );
  }

  const payment = await describePayment(existing);
  if (!payment && existing.status === 'PAYMENT_PENDING') {
    // The first attempt stopped before its payment was recorded: resume it.
    const customerId = await ensureStripeCustomer(apiKey);
    return attachPayment(existing, customerId, apiKey, input, 200);
  }

  return NextResponse.json(
    { mission: existing, payment },
    { status: 200, headers: { 'Idempotent-Replayed': 'true' } }
  );
}

/**
 * When Stripe refused the card or the request, nothing can be paid: the
 * mission is canceled and its Idempotency-Key released so that a corrected
 * request can reuse it. Otherwise (network, Stripe outage, platform
 * misconfiguration) the outcome is unknown and the mission is left awaiting
 * payment: if Stripe did take the payment, the webhook still publishes it, and
 * a retry with the same Idempotency-Key resumes it.
 */
async function paymentFailure(mission: Mission, error: unknown): Promise<NextResponse> {
  console.error('Mission payment setup failed:', error);

  if (error instanceof Stripe.errors.StripeCardError || error instanceof Stripe.errors.StripeInvalidRequestError) {
    await prisma.mission.update({
      where: { id: mission.id },
      data: { status: 'CANCELED', idempotencyKey: null, idempotencyFingerprint: null },
    });
    return error instanceof Stripe.errors.StripeCardError
      ? apiError('PAYMENT_FAILED', error.message, 402)
      : apiError('PAYMENT_REJECTED', error.message, 422);
  }

  return apiError(
    'PAYMENT_PROVIDER_UNAVAILABLE',
    'Le prestataire de paiement est indisponible ; réessayez avec la même Idempotency-Key',
    502,
    { missionId: mission.id }
  );
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

const statusFilterSchema = z.nativeEnum(MissionStatus);

export async function GET(request: NextRequest) {
  try {
    const rawKey = extractApiKey(request);
    const session = rawKey ? null : await auth();

    if (!rawKey && !session?.user) {
      return apiError('UNAUTHORIZED', 'Non autorisé', 401);
    }

    const { searchParams } = new URL(request.url);
    const where: Prisma.MissionWhereInput = {};

    const statusParam = searchParams.get('status');
    let status: MissionStatus | undefined;
    if (statusParam) {
      const parsedStatus = statusFilterSchema.safeParse(statusParam);
      if (!parsedStatus.success) {
        return apiError('INVALID_STATUS', `Statut inconnu : ${statusParam}`, 400);
      }
      status = parsedStatus.data;
    }

    if (rawKey) {
      const apiKey = await validateApiKey(rawKey);
      if (!apiKey) {
        return apiError('INVALID_API_KEY', 'Clé API invalide', 403);
      }
      where.createdByApiKeyId = apiKey.id;
      if (status) where.status = status;
    } else {
      where.status = status ?? 'PUBLISHED';
    }

    const take = Math.min(Math.abs(parseInt(searchParams.get('limit') || '50')) || 50, 100);
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0') || 0);

    const missions = await prisma.mission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { attachments: true },
      take,
      skip,
    });

    return NextResponse.json(missions);
  } catch (error) {
    console.error('Get missions error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}
