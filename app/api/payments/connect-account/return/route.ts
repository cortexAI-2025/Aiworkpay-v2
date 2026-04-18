import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

// Called by Stripe after Connect onboarding completes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.stripeAccountId) {
      const account = await stripe.accounts.retrieve(user.stripeAccountId);
      if (account.details_submitted) {
        await prisma.user.update({
          where: { id: userId },
          data: { stripeAccountOnboarded: true },
        });
      }
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard/account?connect=success`);
}
