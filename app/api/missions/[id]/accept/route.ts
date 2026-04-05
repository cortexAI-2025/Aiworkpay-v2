import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;

    // Check subscription
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    if (user.subscription?.status !== 'ACTIVE' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Abonnement actif requis pour accepter une mission' },
        { status: 403 }
      );
    }

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
        assignedToUserId: session.sub,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Accept mission error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
