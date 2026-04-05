import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      return NextResponse.json({ error: 'Clé introuvable' }, { status: 404 });
    }
    if (key.createdByUserId !== session.sub) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.json({ message: 'Clé révoquée' });
  } catch (error) {
    console.error('Delete API key error:', error);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
