import { NextRequest, NextResponse } from 'next/server';

/**
 * Rejects state-mutating requests whose Origin header doesn't match the
 * app's own origin. Browsers always send Origin on credentialed cross-site
 * fetch() calls, so a mismatch means the request came from another domain.
 *
 * Same-origin requests from the browser may omit Origin (e.g. direct form
 * submissions), so we only reject when Origin is present AND wrong.
 */
export function csrfGuard(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  if (!origin) return null; // same-origin browser request — allow

  try {
    const appOrigin = new URL(request.url).origin;
    if (origin !== appOrigin) {
      return NextResponse.json({ error: 'Origine non autorisée' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
  }

  return null;
}
