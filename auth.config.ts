import type { NextAuthConfig } from 'next-auth';

// Edge-compatible config — no Node.js-only modules (no bcryptjs, no Prisma).
// Used by middleware.ts which runs in the Edge Runtime.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
  providers: [], // Credentials + OAuth providers added in auth.ts (Node.js runtime only)
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.id;
        token.role = (user as { role?: string }).role ?? token.role ?? 'PAYWORKER';
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'PAYWORKER' | 'ADMIN';
      }
      return session;
    },
  },
};
