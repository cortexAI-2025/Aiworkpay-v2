import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Origine invalide' }, { status: 403 });
  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  if (!allowed.includes(session.user.email?.toLowerCase() || '')) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  const expected = process.env.ADMIN_SETUP_TOKEN;
  if (!expected) return NextResponse.json({ error: 'Activation désactivée' }, { status: 403 });
  try {
    const { token } = await request.json();
    if (typeof token !== 'string' || token.length > 256) return NextResponse.json({ error: 'Code invalide' }, { status: 403 });
    const a = Buffer.from(token), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a,b)) return NextResponse.json({ error: 'Code invalide' }, { status: 403 });
    await prisma.user.update({ where: { id: session.user.id }, data: { role: 'ADMIN' } });
    return NextResponse.json({ activated: true });
  } catch { return NextResponse.json({ error: 'Activation impossible' }, { status: 400 }); }
}
