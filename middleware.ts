import NextAuth from 'next-auth';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { authConfig } from '@/auth.config';
import { csrfGuard } from '@/lib/csrfGuard';

// Use the edge-safe config (no bcryptjs / Prisma) for the middleware
const { auth } = NextAuth(authConfig);

const pageGuard = auth((req) => {
  const { nextUrl, auth: session } = req;
  const isLoggedIn = !!session?.user;

  if (nextUrl.pathname.startsWith('/dashboard') && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    const returnPath = nextUrl.pathname;
    // Only allow internal paths to prevent open redirect attacks
    if (returnPath.startsWith('/') && !returnPath.includes('://')) {
      loginUrl.searchParams.set('from', returnPath);
    }
    return Response.redirect(loginUrl);
  }

  if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/signup')) {
    return Response.redirect(new URL('/dashboard', req.url));
  }
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return csrfGuard(request) ?? undefined;
  }
  return pageGuard(request as Parameters<typeof pageGuard>[0], event as never);
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/api/:path*'],
};
