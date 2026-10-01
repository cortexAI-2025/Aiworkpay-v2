import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiKey } from '@prisma/client';
import { validateApiKey } from './apikey';

/**
 * Helpers shared by the routes an agent calls with its API key
 * (`Authorization: Bearer awp_...`). The key is the agent's identity: an agent
 * only ever sees the missions created with its own key.
 */

export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

/**
 * Error body with a stable machine-readable `code` next to the human message,
 * so that an agent (or the MCP server) can branch on it.
 */
export function apiError(code: string, error: string, status: number, details?: unknown) {
  return NextResponse.json(details === undefined ? { error, code } : { error, code, details }, { status });
}

export async function authenticateAgent(
  request: NextRequest
): Promise<{ apiKey: ApiKey; response?: never } | { apiKey?: never; response: NextResponse }> {
  const rawKey = extractApiKey(request);
  if (!rawKey) return { response: apiError('UNAUTHORIZED', 'Clé API manquante', 401) };

  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) return { response: apiError('INVALID_API_KEY', 'Clé API invalide ou désactivée', 403) };

  return { apiKey };
}

// ─── Idempotency ─────────────────────────────────────────────────────────────

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,255}$/;

/**
 * Reads the optional `Idempotency-Key` header. Returns `undefined` when absent,
 * `null` when present but malformed.
 */
export function readIdempotencyKey(request: NextRequest): string | null | undefined {
  const value = request.headers.get('idempotency-key');
  if (value === null) return undefined;
  return IDEMPOTENCY_KEY_PATTERN.test(value) ? value : null;
}

/** Stable hash of a JSON value, independent of key order. */
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
