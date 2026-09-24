import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

// Called by Stripe after Connect onboarding completes
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (accountId) {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      if (account.details_submitted) {
        await prisma.user.updateMany({
          where: { stripeAccountId: accountId },
          data: { stripeAccountOnboarded: true },
        });
      }
    } catch (err) {
      console.error('Connect return error:', err);
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard/account?connect=success`);
}
