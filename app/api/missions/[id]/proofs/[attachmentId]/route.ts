import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { apiError, authenticateAgent, extractApiKey } from '@/lib/agentApi';
import { getStorage } from '@/lib/storage';

type Params = { params: Promise<{ id: string; attachmentId: string }> };

/**
 * Download an uploaded proof. Allowed for:
 * - the agent that ordered the mission (API key with missions:read), once
 *   the mission is delivered;
 * - the assigned Payworker, and admins (session).
 * Anyone else gets 404, as for a file that does not exist.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id, attachmentId } = await params;
    const notFound = () => apiError('PROOF_NOT_FOUND', 'Fichier introuvable', 404);

    const attachment = await prisma.missionAttachment.findFirst({
      where: { id: attachmentId, missionId: id, kind: 'PROOF', storageKey: { not: null } },
      include: { mission: { select: { status: true, createdByApiKeyId: true, assignedToUserId: true } } },
    });

    if (extractApiKey(request)) {
      const { apiKey, response } = await authenticateAgent(request, 'missions:read');
      if (response) return response;
      if (!attachment || attachment.mission.createdByApiKeyId !== apiKey.id) return notFound();
      if (!['DELIVERED', 'COMPLETED'].includes(attachment.mission.status)) return notFound();
    } else {
      const session = await auth();
      if (!session?.user) return apiError('UNAUTHENTICATED', 'Non authentifié', 401);
      const allowed = session.user.role === 'ADMIN' || attachment?.mission.assignedToUserId === session.user.id;
      if (!attachment || !allowed) return notFound();
    }

    const content = await getStorage().get(attachment.storageKey!);
    const mime = attachment.mimeType ?? 'application/octet-stream';
    // Images display inline (thumbnails); anything else downloads.
    const disposition = mime.startsWith('image/') ? 'inline' : 'attachment';

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(content.length),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error('Proof download error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}

/** The assigned Payworker removes one of its files while the mission is in progress. */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user) return apiError('UNAUTHENTICATED', 'Non authentifié', 401);

    const { id, attachmentId } = await params;
    const attachment = await prisma.missionAttachment.findFirst({
      where: { id: attachmentId, missionId: id, kind: 'PROOF', storageKey: { not: null } },
      include: { mission: { select: { status: true, assignedToUserId: true } } },
    });
    if (!attachment || attachment.mission.assignedToUserId !== session.user.id) {
      return apiError('PROOF_NOT_FOUND', 'Fichier introuvable', 404);
    }
    if (attachment.mission.status !== 'IN_PROGRESS') {
      return apiError('MISSION_NOT_IN_PROGRESS', 'Les preuves ne se modifient que pendant que la mission est en cours', 409);
    }

    await prisma.missionAttachment.delete({ where: { id: attachmentId } });
    try {
      await getStorage().delete(attachment.storageKey!);
    } catch (error) {
      // The file is unreachable once its row is gone; an orphan object is only a storage cost.
      console.error('Proof file deletion failed:', error);
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('Proof delete error:', error);
    return apiError('INTERNAL_ERROR', 'Erreur interne du serveur', 500);
  }
}
