import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/apikey';
import { getSessionFromRequest } from '@/lib/auth';

const createMissionSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  budget: z.number().positive(),
  currency: z.string().length(3).default('EUR'),
  deadline: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});

function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const rawKey = extractApiKey(request);

    if (!rawKey) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 401 });
    }

    const apiKey = await validateApiKey(rawKey);
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API invalide ou désactivée' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createMissionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { title, description, budget, currency, deadline, priority } = parsed.data;

    const mission = await prisma.mission.create({
      data: {
        title,
        description,
        budget,
        currency: currency.toUpperCase(),
        deadline: new Date(deadline),
        priority,
        status: 'PUBLISHED',
        createdByApiKeyId: apiKey.id,
      },
    });

    return NextResponse.json(mission, { status: 201 });
  } catch (error) {
    console.error('Create mission error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Check if called by API key (agent) or authenticated user
    const rawKey = extractApiKey(request);
    const session = await getSessionFromRequest(request);

    if (!rawKey && !session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const where: Record<string, unknown> = {};

    if (rawKey) {
      const apiKey = await validateApiKey(rawKey);
      if (!apiKey) {
        return NextResponse.json({ error: 'Clé API invalide' }, { status: 403 });
      }
      // Agents see only their own missions
      where.createdByApiKeyId = apiKey.id;
    } else if (session) {
      // Users see published missions or their own missions
      const status = searchParams.get('status');
      if (status) {
        where.status = status;
      } else {
        where.status = 'PUBLISHED';
      }
    }

    const missions = await prisma.mission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { attachments: true },
    });

    return NextResponse.json(missions);
  } catch (error) {
    console.error('Get missions error:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
