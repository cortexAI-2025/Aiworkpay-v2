import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

// Use the edge-safe config (no bcryptjs / Prisma) for the middleware
const { auth } = NextAuth(authConfig);

export default auth((req) => {
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

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
};
