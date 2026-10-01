import type { NextAuthConfig } from 'next-auth';

// Edge-compatible config — no Node.js-only modules (no bcryptjs, no Prisma).
// Used by middleware.ts which runs in the Edge Runtime.
// Callbacks are intentionally absent here: auth.ts overrides them with the
// full JWT/session logic (DB access for role sync). Defining them here too
// would be dead code since auth.ts spreads this config and replaces callbacks.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
  providers: [], // Credentials + OAuth providers added in auth.ts (Node.js runtime only)
};
