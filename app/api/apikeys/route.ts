import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { ALL_SCOPES, generateApiKey, type ApiKeyScope } from '@/lib/apikey';

const createKeySchema = z.object({
  label: z.string().min(1).max(100),
  // Least privilege: an agent that only reads results needs missions:read
  scopes: z
    .array(z.enum(ALL_SCOPES as [ApiKeyScope, ...ApiKeyScope[]]))
    .min(1)
    .default(['missions:read', 'missions:write'])
    .transform((scopes) => [...new Set(scopes)]),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
  maxMissionBudget: z.number().positive().max(99_999_999).multipleOf(0.01).optional(),
  monthlyBudget: z.number().positive().max(99_999_999).multipleOf(0.01).optional(),
});

/** What the dashboard sees of a key: never its hash. */
const PUBLIC_FIELDS = {
  id: true,
  label: true,
  keyPrefix: true,
  active: true,
  scopes: true,
  expiresAt: true,
  lastUsedAt: true,
  maxMissionBudget: true,
  monthlyBudget: true,
  createdAt: true,
} as const;

async function requireAdmin(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }
  if (session.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(request: NextRequest) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const keys = await prisma.apiKey.findMany({
    where: { createdByUserId: session!.user.id },
    orderBy: { createdAt: 'desc' },
    select: PUBLIC_FIELDS,
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
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }
    const { label, scopes, expiresInDays, maxMissionBudget, monthlyBudget } = parsed.data;

    const { key, keyHash, keyPrefix } = generateApiKey();
    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        label,
        active: true,
        scopes,
        expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000) : null,
        maxMissionBudget: maxMissionBudget ?? null,
        monthlyBudget: monthlyBudget ?? null,
        createdByUserId: session!.user.id,
      },
      select: PUBLIC_FIELDS,
    });

    // The only time the key is ever returned: it is not stored, only its hash.
    return NextResponse.json({ ...apiKey, key }, { status: 201 });
  } catch (err) {
    console.error('Create API key error:', err);
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 });
  }
}
