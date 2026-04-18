import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'PAYWORKER' | 'ADMIN';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'PAYWORKER' | 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
  }
}
