import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'Aucun abonnement actif trouvé' }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/dashboard/account`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'ouverture du portail de facturation' }, { status: 500 });
  }
}
