import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

// Create or retrieve Stripe Connect account and return onboarding URL
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!user.email) {
      return NextResponse.json({ error: 'Un email est requis pour configurer Stripe' }, { status: 400 });
    }

    let accountId = user.stripeAccountId;

    if (!accountId) {
      // Idempotency key prevents duplicate accounts on concurrent requests
      const account = await stripe.accounts.create(
        {
          type: 'express',
          email: user.email,
          capabilities: {
            transfers: { requested: true },
          },
          metadata: { userId: user.id },
        },
        { idempotencyKey: `connect_${user.id}` }
      );
      accountId = account.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: accountId },
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/dashboard/account?connect=refresh`,
      return_url: `${appUrl}/api/payments/connect-account/return?accountId=${accountId}`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error) {
    console.error('Connect account error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création du compte Stripe' }, { status: 500 });
  }
}

// GET: check current Connect account status
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.stripeAccountId) {
      return NextResponse.json({ connected: false });
    }

    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    const onboarded =
      account.details_submitted &&
      account.capabilities?.transfers === 'active';

    if (onboarded && !user.stripeAccountOnboarded) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountOnboarded: true },
      });
    }

    return NextResponse.json({
      connected: true,
      onboarded,
      accountId: user.stripeAccountId,
      detailsSubmitted: account.details_submitted,
    });
  } catch (error) {
    console.error('Connect status error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
