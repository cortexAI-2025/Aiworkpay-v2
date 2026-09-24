import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/apikey';
import { stripe } from '@/lib/stripe';
import { auth } from '@/auth';

const createMissionSchema = z.object({
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
  // Optionally provide a Stripe payment_method_id for immediate charge
  paymentMethodId: z.string().optional(),
});

function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const rawKey = extractApiKey(request);
    if (!rawKey) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 401 });
    }

    const apiKey = await validateApiKey(rawKey);
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API invalide ou désactivée' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createMissionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, budget, currency, deadline, priority, paymentMethodId } = parsed.data;
    const amountCents = Math.round(budget * 100);

    // Ensure the API key has a Stripe customer
    let customerId = apiKey.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        description: apiKey.label,
        metadata: { apiKeyId: apiKey.id },
      });
      customerId = customer.id;
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create mission first
    const mission = await prisma.mission.create({
      data: {
        title,
        description,
        budget,
        currency: currency.toUpperCase(),
        deadline: new Date(deadline),
        priority,
        status: 'PAYMENT_PENDING',
        createdByApiKeyId: apiKey.id,
      },
    });

    // Create Stripe PaymentIntent for the agent
    const paymentIntentData: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: amountCents,
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: { missionId: mission.id, apiKeyId: apiKey.id },
      description: `Mission: ${title}`,
    };

    // If agent provides a payment method, confirm immediately
    if (paymentMethodId) {
      paymentIntentData.payment_method = paymentMethodId;
      paymentIntentData.confirm = true;
      paymentIntentData.return_url = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/missions/${mission.id}/payment-success`
        : undefined;
    } else {
      paymentIntentData.automatic_payment_methods = { enabled: true };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    // Store the PaymentIntent ID on the mission
    await prisma.mission.update({
      where: { id: mission.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    });

    return NextResponse.json(
      {
        mission: { ...mission, stripePaymentIntentId: paymentIntent.id },
        payment: {
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create mission error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const rawKey = extractApiKey(request);
    const session = await auth();

    if (!rawKey && !session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const where: Record<string, unknown> = {};

    if (rawKey) {
      const apiKey = await validateApiKey(rawKey);
      if (!apiKey) {
        return NextResponse.json({ error: 'Clé API invalide' }, { status: 403 });
      }
      where.createdByApiKeyId = apiKey.id;
    } else {
      const status = searchParams.get('status');
      where.status = status || 'PUBLISHED';
    }

    const take = Math.min(Math.abs(parseInt(searchParams.get('limit') || '50')), 100);
    const skip = Math.max(0, parseInt(searchParams.get('skip') || '0'));

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
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
