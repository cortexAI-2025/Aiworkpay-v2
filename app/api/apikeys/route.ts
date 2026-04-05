import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { generateApiKey } from '@/lib/apikey';

const createKeySchema = z.object({
  label: z.string().min(1).max(100),
});

async function requireAdmin(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }
  if (session.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const keys = await prisma.apiKey.findMany({
    where: { createdByUserId: session!.sub },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const parsed = createKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Libellé invalide' }, { status: 400 });
    }

    const key = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        label: parsed.data.label,
        active: true,
        createdByUserId: session!.sub,
      },
    });

    return NextResponse.json(apiKey, { status: 201 });
  } catch (err) {
    console.error('Create API key error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
