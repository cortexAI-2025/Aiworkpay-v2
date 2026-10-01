import { createHash, randomBytes } from 'crypto';
import type { ApiKey } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Agent API keys. The key is shown once, when it is created; the database
 * only keeps its SHA-256 hash and a short prefix to recognise it. A plain
 * (unsalted, fast) hash is enough: the key carries 288 random bits, so it
 * cannot be guessed from its hash.
 */

export const API_KEY_SCOPES = {
  'missions:read': 'Lire ses missions et leurs résultats',
  'missions:write': 'Créer et annuler des missions',
  'missions:approve': 'Valider un résultat (paie le Payworker) ou demander des corrections',
} as const;

export type ApiKeyScope = keyof typeof API_KEY_SCOPES;

export const ALL_SCOPES = Object.keys(API_KEY_SCOPES) as ApiKeyScope[];

const KEY_PREFIX = 'awp_';
const DISPLAY_PREFIX_LENGTH = 12; // "awp_" + 8 characters

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function generateApiKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = KEY_PREFIX + randomBytes(36).toString('hex');
  return { key, keyHash: hashApiKey(key), keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH) };
}

/** Last use is recorded at most once a minute per key, to spare the database. */
const LAST_USED_RESOLUTION_MS = 60_000;

export async function validateApiKey(key: string): Promise<ApiKey | null> {
  if (!key.startsWith(KEY_PREFIX) || key.length > 200) return null;

  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (!apiKey || !apiKey.active) return null;
  if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) return null;

  const now = Date.now();
  if (!apiKey.lastUsedAt || now - apiKey.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date(now) } });
  }
  return apiKey;
}

export function hasScope(apiKey: Pick<ApiKey, 'scopes'>, scope: ApiKeyScope): boolean {
  return apiKey.scopes.includes(scope);
}
