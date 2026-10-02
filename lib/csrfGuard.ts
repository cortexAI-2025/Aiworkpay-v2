import { NextRequest, NextResponse } from 'next/server';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects state-mutating requests sent by a browser from another site.
 * Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE; server-to-server
 * callers (AI agents with API keys, Stripe webhooks) send none and are allowed.
 * Hosts are compared rather than full origins because behind Railway's proxy the
 * request URL may be http:// while the browser's Origin is https://.
 */
export function csrfGuard(request: NextRequest): NextResponse | null {
  if (SAFE_METHODS.has(request.method)) return null;
  const origin = request.headers.get('origin');
  if (!origin) return null;

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = '';
  }
  if (!host || originHost !== host) {
    return NextResponse.json({ error: 'Origine non autorisée' }, { status: 403 });
  }
  return null;
}
