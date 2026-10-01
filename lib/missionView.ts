import type { Mission, MissionAttachment, MissionStatus } from '@prisma/client';

/** Statuses in which the agent may see what the Payworker delivered. */
const RESULT_VISIBLE: readonly MissionStatus[] = ['DELIVERED', 'COMPLETED'];

export type PublicAttachment = Omit<MissionAttachment, 'storageKey' | 'uploadedById'> & {
  /** `upload`: file stored by AIWorkPay, downloaded from `url` with the same credentials. `link`: external URL. */
  source: 'upload' | 'link';
};

export function publicAttachment(attachment: MissionAttachment): PublicAttachment {
  const { storageKey, uploadedById: _uploadedBy, ...rest } = attachment;
  return { ...rest, source: storageKey ? 'upload' : 'link' };
}

/**
 * A mission as its agent sees it: proofs only once delivered (files uploaded
 * while the Payworker is still working are not the result yet), and no
 * internal storage details.
 */
export function missionForAgent<M extends Mission & { attachments?: MissionAttachment[] }>(mission: M) {
  if (!mission.attachments) return mission;
  const showProofs = RESULT_VISIBLE.includes(mission.status);
  return {
    ...mission,
    attachments: mission.attachments
      .filter((attachment) => attachment.kind !== 'PROOF' || showProofs)
      .map(publicAttachment),
  };
}

/** Download URL of an uploaded proof (requires the same credentials as the API). */
export function proofUrl(missionId: string, attachmentId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  return `${base}/api/missions/${missionId}/proofs/${attachmentId}`;
}
