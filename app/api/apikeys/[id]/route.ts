import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  const { id } = await params;

  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) return NextResponse.json({ error: 'Clé introuvable' }, { status: 404 });
  if (key.createdByUserId !== session.user.id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  await prisma.apiKey.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ message: 'Clé révoquée' });
}
