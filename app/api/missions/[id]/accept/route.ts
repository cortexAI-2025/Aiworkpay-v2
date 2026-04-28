import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const mission = await prisma.mission.findUnique({ where: { id } });
    if (!mission) {
      return NextResponse.json({ error: 'Mission introuvable' }, { status: 404 });
    }

    if (mission.status !== 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Cette mission n\'est plus disponible' },
        { status: 409 }
      );
    }

    const updated = await prisma.mission.update({
      where: { id },
      data: {
        status: 'ASSIGNED',
        assignedToUserId: userId,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Accept mission error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
