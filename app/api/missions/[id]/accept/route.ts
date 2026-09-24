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
    if (session.user.role !== 'PAYWORKER') {
      return NextResponse.json({ error: 'Action réservée aux Payworkers' }, { status: 403 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const worker = await prisma.user.findUnique({
      where: { id: userId },
      select: { stripeAccountOnboarded: true },
    });
    if (!worker?.stripeAccountOnboarded) {
      return NextResponse.json(
        { error: 'Configurez d\'abord votre compte de paiement Stripe' },
        { status: 409 }
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

    // Compare-and-set prevents two workers from accepting the same mission.
    const claimed = await prisma.mission.updateMany({
      where: { id, status: 'PUBLISHED', assignedToUserId: null },
      data: {
        status: 'ASSIGNED',
        assignedToUserId: userId,
      },
    });

    if (claimed.count !== 1) {
      return NextResponse.json({ error: 'Cette mission vient d\'être attribuée' }, { status: 409 });
    }

    const updated = await prisma.mission.findUniqueOrThrow({ where: { id } });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Accept mission error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
