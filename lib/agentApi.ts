import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ApiKey } from '@prisma/client';
import { hasScope, validateApiKey, type ApiKeyScope } from './apikey';
import { clientIp, exhausted, hit, LIMITS } from './rateLimit';
import { prisma } from './prisma';

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
export function apiError(
  code: string,
  error: string,
  status: number,
  details?: unknown,
  headers?: Record<string, string>
) {
  return NextResponse.json(details === undefined ? { error, code } : { error, code, details }, { status, headers });
}

function rateLimited(retryAfter: number, message: string) {
  return apiError('RATE_LIMITED', message, 429, { retryAfterSeconds: retryAfter }, { 'Retry-After': String(retryAfter) });
}

/**
 * Authenticate an agent and check that its key may perform `scope`.
 *
 * Order matters: an address that failed too often is stopped before its key
 * is even looked at, so that guessing keys stays impractical.
 */
export async function authenticateAgent(
  request: NextRequest,
  scope: ApiKeyScope
): Promise<{ apiKey: ApiKey; response?: never } | { apiKey?: never; response: NextResponse }> {
  const rawKey = extractApiKey(request);
  if (!rawKey) return { response: apiError('UNAUTHORIZED', 'Clé API manquante', 401) };

  const failureBucket = `authfail:${clientIp(request)}`;
  const blocked = await exhausted(failureBucket, LIMITS.authFailures);
  if (!blocked.allowed) {
    return { response: rateLimited(blocked.retryAfter, "Trop d'échecs d'authentification depuis cette adresse") };
  }

  const apiKey = await validateApiKey(rawKey);
  if (!apiKey) {
    await hit(failureBucket, LIMITS.authFailures);
    return { response: apiError('INVALID_API_KEY', 'Clé API invalide, expirée ou révoquée', 403) };
  }

  if (!hasScope(apiKey, scope)) {
    return {
      response: apiError('INSUFFICIENT_SCOPE', `Cette clé API n'a pas la permission « ${scope} »`, 403, {
        requiredScope: scope,
        keyScopes: apiKey.scopes,
      }),
    };
  }

  const usage = await hit(`key:${apiKey.id}:requests`, LIMITS.agentRequests);
  if (!usage.allowed) return { response: rateLimited(usage.retryAfter, 'Trop de requêtes pour cette clé API') };

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

// ─── Missions owned by the calling agent ─────────────────────────────────────

/** The mission if it was created with this API key, otherwise null (answer 404). */
export function findOwnedMission(apiKey: Pick<ApiKey, 'id'>, missionId: string) {
  return prisma.mission.findFirst({ where: { id: missionId, createdByApiKeyId: apiKey.id } });
}

/** Optional JSON body: an empty body is accepted, malformed JSON is not. */
export async function readOptionalJson(request: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const text = await request.text();
  if (!text.trim()) return { ok: true, body: {} };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}
