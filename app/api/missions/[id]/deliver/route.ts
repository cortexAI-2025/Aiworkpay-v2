import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { apiError } from '@/lib/agentApi';

const MAX_RESULT_DATA_BYTES = 64 * 1024;

const deliverSchema = z.object({
  // What was done and observed, readable by the agent as is
  note: z.string().trim().min(1).max(20_000),
  // Structured result, e.g. the fields the mission asked for
  data: z
    .record(z.unknown())
    .optional()
    .refine((value) => value === undefined || JSON.stringify(value).length <= MAX_RESULT_DATA_BYTES, {
      message: '`data` ne doit pas dépasser 64 Ko',
    }),
  // Proof hosted elsewhere (photos, documents): links only, no upload here
  attachments: z
    .array(
      z.object({
        url: z.string().url().max(2048).refine((url) => url.startsWith('https://'), {
          message: 'Seules les URL https sont acceptées',
        }),
        filename: z.string().trim().min(1).max(255),
        mimeType: z.string().max(255).optional(),
        size: z.number().int().nonnegative().optional(),
      })
    )
    .max(20)
    .default([]),
});

/**
 * The assigned Payworker delivers the result of its mission:
 * IN_PROGRESS → DELIVERED. The agent then reads it with GET /api/missions/{id}.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return apiError('UNAUTHENTICATED', 'Non authentifié', 401);
    }
    if (session.user.role !== 'PAYWORKER') {
      return apiError('PAYWORKER_REQUIRED', 'Action réservée aux Payworkers', 403);
    }

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('INVALID_JSON', 'Corps JSON invalide', 400);
    }

    const parsed = deliverSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_BODY', 'Données invalides', 400, parsed.error.flatten());
    }
    const { note, data, attachments } = parsed.data;

    const mission = await prisma.mission.findUnique({
      where: { id },
      select: { id: true, status: true, assignedToUserId: true },
    });
    if (!mission || mission.assignedToUserId !== session.user.id) {
      return apiError('MISSION_NOT_FOUND', 'Mission introuvable', 404);
    }

    const delivered = await prisma.$transaction(async (tx) => {
      // Compare-and-set: only one delivery, and only while the mission is in progress
      const claimed = await tx.mission.updateMany({
        where: { id, status: 'IN_PROGRESS', assignedToUserId: session.user.id },
        data: {
          status: 'DELIVERED',
          resultNote: note,
          resultData: data === undefined ? undefined : (data as Prisma.InputJsonObject),
          deliveredAt: new Date(),
        },
      });
      if (claimed.count !== 1) return null;

      if (attachments.length > 0) {
        await tx.missionAttachment.createMany({
          data: attachments.map((attachment) => ({ ...attachment, missionId: id, kind: 'PROOF' as const })),
        });
      }

      return tx.mission.findUniqueOrThrow({
        where: { id },
        include: { attachments: { orderBy: { createdAt: 'asc' } } },
      });
    });

    if (!delivered) {
      return apiError(
        'MISSION_NOT_IN_PROGRESS',
        `La mission doit être en cours pour être livrée (statut actuel : ${mission.status})`,
        409
      );
    }

    return NextResponse.json(delivered);
  } catch (error) {
    console.error('Deliver mission error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}
