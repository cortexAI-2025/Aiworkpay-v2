import { randomBytes } from 'crypto';
import { prisma } from './prisma';

export async function validateApiKey(key: string) {
  // findFirst is required because `active` is not a unique field
  const apiKey = await prisma.apiKey.findFirst({
    where: { key, active: true },
  });
  return apiKey;
}

export function generateApiKey(): string {
  return 'awp_' + randomBytes(36).toString('hex');
}
