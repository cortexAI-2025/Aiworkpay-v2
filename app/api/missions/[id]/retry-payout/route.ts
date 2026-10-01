import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { retryMissionPayout } from '@/lib/missionLifecycle';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Origine invalide' }, { status: 403 });
  try {
    const { id } = await params;
    return NextResponse.json(await retryMissionPayout(id));
  } catch { return NextResponse.json({ error: 'Virement indisponible' }, { status: 409 }); }
}
