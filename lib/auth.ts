// Session management is now handled by NextAuth (auth.ts at root).
// This file is kept as a re-export shim for any remaining legacy imports.
export { auth as getSession, signIn, signOut } from '@/auth';
