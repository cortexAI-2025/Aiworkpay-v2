import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/agentApi';
import { hit } from '@/lib/rateLimit';
import { proofUrl, publicAttachment } from '@/lib/missionView';
import { AntivirusUnavailable, scanFile, type ScanResult } from '@/lib/antivirus';
import { ACCEPTED_TYPES, detectType, getStorage, safeFilename, UPLOAD_LIMITS } from '@/lib/storage';

/** Uploads per Payworker, whatever the mission: a brake on filling the storage. */
const UPLOADS_PER_HOUR = { max: 120, windowSeconds: 3600 };

/**
 * The assigned Payworker uploads one proof file (multipart field `file`) while
 * the mission is in progress. Files are checked by content, scanned by the
 * antivirus, stored privately, and become part of the result when the mission
 * is delivered.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return apiError('UNAUTHENTICATED', 'Non authentifié', 401);
    if (session.user.role !== 'PAYWORKER') return apiError('PAYWORKER_REQUIRED', 'Action réservée aux Payworkers', 403);
    const userId = session.user.id;

    const { id } = await params;
    const mission = await prisma.mission.findUnique({ where: { id }, select: { status: true, assignedToUserId: true } });
    if (!mission || mission.assignedToUserId !== userId) return apiError('MISSION_NOT_FOUND', 'Mission introuvable', 404);
    if (mission.status !== 'IN_PROGRESS') {
      return apiError('MISSION_NOT_IN_PROGRESS', 'Les preuves s’ajoutent pendant que la mission est en cours', 409);
    }

    // Refuse oversized bodies before reading them
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > UPLOAD_LIMITS.maxFileBytes + 64 * 1024) return tooLarge();

    const rate = await hit(`user:${userId}:uploads`, UPLOADS_PER_HOUR);
    if (!rate.allowed) {
      return apiError('RATE_LIMITED', 'Trop de fichiers envoyés ; réessayez plus tard', 429, undefined, {
        'Retry-After': String(rate.retryAfter),
      });
    }

    let file: FormDataEntryValue | null;
    try {
      file = (await request.formData()).get('file');
    } catch {
      return apiError('INVALID_BODY', 'Envoyez le fichier en multipart/form-data, champ « file »', 400);
    }
    if (!(file instanceof File)) {
      return apiError('INVALID_BODY', 'Envoyez le fichier en multipart/form-data, champ « file »', 400);
    }
    if (file.size === 0) return apiError('EMPTY_FILE', 'Le fichier est vide', 400);
    if (file.size > UPLOAD_LIMITS.maxFileBytes) return tooLarge();

    const content = Buffer.from(await file.arrayBuffer());
    const type = detectType(content);
    if (!type) {
      return apiError('UNSUPPORTED_FILE_TYPE', 'Formats acceptés : JPEG, PNG, WebP, HEIC, PDF', 415, {
        acceptedTypes: ACCEPTED_TYPES,
      });
    }

    // Nothing is stored before the antivirus has cleared it.
    let scan: ScanResult;
    try {
      scan = await scanFile(content);
    } catch (error) {
      if (!(error instanceof AntivirusUnavailable)) throw error;
      console.error('Antivirus unavailable, upload refused:', error.message);
      return apiError('ANTIVIRUS_UNAVAILABLE', 'L’analyse antivirus est indisponible ; réessayez plus tard', 503);
    }
    if (scan.status === 'infected') {
      console.warn(
        JSON.stringify({ event: 'proof.infected', missionId: id, userId, signature: scan.signature, size: content.length })
      );
      return apiError(
        'FILE_INFECTED',
        'L’antivirus a détecté une menace dans ce fichier : il a été refusé',
        422,
        { signature: scan.signature }
      );
    }

    const attachmentId = randomUUID();
    const storageKey = `missions/${id}/${attachmentId}.${type.extension}`;

    // Reserve the slot first (count under a per-mission lock), then store.
    const reserved = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`proofs:${id}`}))::text`;
      const count = await tx.missionAttachment.count({ where: { missionId: id, kind: 'PROOF', storageKey: { not: null } } });
      if (count >= UPLOAD_LIMITS.maxFilesPerMission) return null;
      return tx.missionAttachment.create({
        data: {
          id: attachmentId,
          missionId: id,
          kind: 'PROOF',
          url: proofUrl(id, attachmentId),
          filename: safeFilename(file.name, type.extension),
          mimeType: type.mime,
          size: content.length,
          storageKey,
          uploadedById: userId,
          scanStatus: scan.status === 'clean' ? 'CLEAN' : 'NOT_SCANNED',
          scannedAt: scan.status === 'clean' ? new Date() : null,
        },
      });
    });
    if (!reserved) {
      return apiError('TOO_MANY_FILES', `${UPLOAD_LIMITS.maxFilesPerMission} fichiers au maximum par mission`, 409);
    }

    try {
      await getStorage().put(storageKey, content, type.mime);
    } catch (error) {
      console.error('Proof storage failed:', error);
      await prisma.missionAttachment.delete({ where: { id: attachmentId } });
      return apiError('STORAGE_UNAVAILABLE', 'Le stockage des fichiers est indisponible ; réessayez', 503);
    }

    return NextResponse.json(publicAttachment(reserved), { status: 201 });
  } catch (error) {
    console.error('Proof upload error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}

function tooLarge() {
  return apiError('FILE_TOO_LARGE', `Fichier trop volumineux (${UPLOAD_LIMITS.maxFileBytes / 1024 / 1024} Mo au maximum)`, 413, {
    maxBytes: UPLOAD_LIMITS.maxFileBytes,
  });
}
