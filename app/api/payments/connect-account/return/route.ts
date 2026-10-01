import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { auth } from '@/auth';

// Called by Stripe after Connect onboarding completes
export async function GET(request: NextRequest) {
  const session = await auth();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');

  if (accountId) {
    try {
      // Verify the account belongs to the authenticated user before updating
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { stripeAccountId: true },
      });

      if (user?.stripeAccountId === accountId) {
        const account = await stripe.accounts.retrieve(accountId);
        if (account.details_submitted) {
          await prisma.user.update({
            where: { id: session.user.id },
            data: { stripeAccountOnboarded: true },
          });
        }
      }
    } catch (err) {
      console.error('Connect return error:', err);
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard/account?connect=success`);
}
