import { NextRequest } from 'next/server';
import { prisma } from './prisma';

/**
 * Fixed-window rate limits, counted in PostgreSQL so that they hold across
 * every instance of the app.
 *
 * If the counter cannot be reached, the request goes through and the failure
 * is logged (fail open): limits slow abuse down, they are not the security
 * boundary — authentication and the per-key checks are.
 */

export interface Limit {
  max: number;
  windowSeconds: number;
}

function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const LIMITS = {
  /** Any agent request, per API key. */
  agentRequests: { max: envInt('RATE_LIMIT_AGENT_PER_MINUTE', 120), windowSeconds: 60 },
  /** New missions, per API key. */
  missionCreations: { max: envInt('RATE_LIMIT_CREATIONS_PER_HOUR', 30), windowSeconds: 3600 },
  /** Failed authentications, per IP address: slows down key guessing. */
  authFailures: { max: envInt('RATE_LIMIT_AUTH_FAILURES_PER_10_MIN', 20), windowSeconds: 600 },
  /** Account creation, per IP. */
  signup: { max: envInt('RATE_LIMIT_SIGNUP_PER_HOUR', 10), windowSeconds: 3600 },
  /** Password reset requests, per IP. */
  passwordReset: { max: envInt('RATE_LIMIT_PASSWORD_RESET_PER_HOUR', 5), windowSeconds: 3600 },
  /** Contact form submissions, per IP. */
  contactForm: { max: envInt('RATE_LIMIT_CONTACT_PER_HOUR', 5), windowSeconds: 3600 },
} satisfies Record<string, Limit>;

export interface RateDecision {
  allowed: boolean;
  /** Seconds until the window resets. */
  retryAfter: number;
}

function window(bucket: string, limit: Limit) {
  const now = Date.now();
  const windowMs = limit.windowSeconds * 1000;
  const index = Math.floor(now / windowMs);
  const end = (index + 1) * windowMs;
  return { id: `${bucket}:${index}`, expiresAt: new Date(end), retryAfter: Math.max(1, Math.ceil((end - now) / 1000)) };
}

/** Count one event and say whether it stays within the limit. */
export async function hit(bucket: string, limit: Limit): Promise<RateDecision> {
  const w = window(bucket, limit);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimitBucket" ("id", "count", "expiresAt")
      VALUES (${w.id}, 1, ${w.expiresAt})
      ON CONFLICT ("id") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
      RETURNING "count"`;
    maybeCleanUp();
    const count = Number(rows[0]?.count ?? 0);
    return { allowed: count <= limit.max, retryAfter: w.retryAfter };
  } catch (error) {
    console.error('Rate limit counter unavailable, request let through:', error);
    return { allowed: true, retryAfter: 0 };
  }
}

/** Whether the limit is already exhausted, without counting this request. */
export async function exhausted(bucket: string, limit: Limit): Promise<RateDecision> {
  const w = window(bucket, limit);
  try {
    const row = await prisma.rateLimitBucket.findUnique({ where: { id: w.id }, select: { count: true } });
    return { allowed: (row?.count ?? 0) < limit.max, retryAfter: w.retryAfter };
  } catch (error) {
    console.error('Rate limit counter unavailable, request let through:', error);
    return { allowed: true, retryAfter: 0 };
  }
}

/** Expired windows are deleted now and then, by whichever request comes by. */
function maybeCleanUp(): void {
  if (Math.random() > 0.01) return;
  prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((error) => {
    console.error('Rate limit cleanup failed:', error);
  });
}

/**
 * Client address. Behind the reverse proxy the app is deployed with, the first
 * X-Forwarded-For entry is the client; deployments exposed directly must not
 * trust that header (set TRUST_PROXY=false).
 */
export function clientIp(request: NextRequest): string {
  if (process.env.TRUST_PROXY !== 'false') {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0]!.trim();
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  return 'unknown';
}
