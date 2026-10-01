import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import MissionActions from './MissionActions';

const priorityLabel: Record<string, string> = { LOW: 'Faible', MEDIUM: 'Moyen', HIGH: 'Haute' };
const priorityColor: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
};
const statusLabels: Record<string, string> = {
  PAYMENT_PENDING: 'Paiement en attente',
  CREATED: 'Créée', PUBLISHED: 'Publiée', ASSIGNED: 'Assignée',
  IN_PROGRESS: 'En cours', DELIVERED: 'Livrée', COMPLETED: 'Terminée', CANCELED: 'Annulée',
};
const statusColors: Record<string, string> = {
  PAYMENT_PENDING: 'bg-orange-100 text-orange-700',
  CREATED: 'bg-gray-100 text-gray-700', PUBLISHED: 'bg-blue-100 text-blue-700',
  ASSIGNED: 'bg-purple-100 text-purple-700', IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DELIVERED: 'bg-orange-100 text-orange-700', COMPLETED: 'bg-green-100 text-green-700',
  CANCELED: 'bg-red-100 text-red-700',
};

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;

  const { id } = await params;

  const [mission, user] = await Promise.all([
    prisma.mission.findUnique({
      where: { id },
      include: {
        attachments: true,
        createdByApiKey: { select: { label: true } },
        assignedTo: { select: { email: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeAccountOnboarded: true },
    }),
  ]);

  if (!mission) notFound();

  if (
    session.user.role !== 'ADMIN' &&
    mission.status !== 'PUBLISHED' &&
    mission.assignedToUserId !== session.user.id
  ) notFound();

  const isAssignedToMe = mission.assignedToUserId === session.user.id;
  const deadlineDate = new Date(mission.deadline);
  const isOverdue = deadlineDate < new Date() && !['COMPLETED', 'CANCELED'].includes(mission.status);

  const briefAttachments = mission.attachments.filter((att) => att.kind === 'BRIEF');
  const proofAttachments = mission.attachments.filter((att) => att.kind === 'PROOF');
  const canSeeResult = isAssignedToMe || session.user.role === 'ADMIN';

  // Show 90/10 breakdown to assignee
  const showCommission = isAssignedToMe && Number(mission.budget) > 0;
  const payworkerEarning = showCommission
    ? parseFloat((Number(mission.budget) * 0.9).toFixed(2))
    : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/missions" className="text-sm text-gray-500 hover:text-brand transition-colors flex items-center">
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux missions
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{mission.title}</h1>
            <div className="flex flex-wrap gap-2">
              <span className={`status-badge ${statusColors[mission.status]}`}>
                {statusLabels[mission.status]}
              </span>
              <span className={`status-badge ${priorityColor[mission.priority]}`}>
                Priorité {priorityLabel[mission.priority]}
              </span>
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-3xl font-extrabold text-green-600">
              {Number(mission.budget).toLocaleString('fr-FR')} {mission.currency}
            </div>
            {showCommission && (
              <div className="text-sm text-green-700 font-medium mt-1">
                Vous recevez : {payworkerEarning.toLocaleString('fr-FR')} {mission.currency}
                <span className="text-xs text-gray-400 ml-1">(90 %)</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
          {mission.description}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl mb-1">📅</div>
          <div className="text-xs text-gray-500 mb-1">Date limite</div>
          <div className={`font-semibold text-sm ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
            {deadlineDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {isOverdue && ' ⚠️'}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-2xl mb-1">🤖</div>
          <div className="text-xs text-gray-500 mb-1">Créée par</div>
          <div className="font-semibold text-sm text-gray-900">
            {mission.createdByApiKey?.label || 'Utilisateur'}
          </div>
        </div>
        <div className="card text-center">
          <div className="text-2xl mb-1">👷</div>
          <div className="text-xs text-gray-500 mb-1">Assignée à</div>
          <div className="font-semibold text-sm text-gray-900 truncate">
            {mission.assignedTo?.email || 'Non assignée'}
          </div>
        </div>
      </div>

      {/* Attachments */}
      {briefAttachments.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Pièces jointes</h2>
          <div className="space-y-2">
            {briefAttachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-brand hover:bg-brand/5 transition-colors"
              >
                <span className="text-xl mr-3">📎</span>
                <span className="text-sm text-gray-700 flex-1">{att.filename}</span>
                {att.size && <span className="text-xs text-gray-400">{(att.size / 1024).toFixed(1)} KB</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Changes requested by the agent */}
      {isAssignedToMe && mission.status === 'IN_PROGRESS' && mission.revisionFeedback && (
        <div className="card border-amber-300 bg-amber-50">
          <h2 className="font-semibold text-amber-900 mb-2">Corrections demandées par l&apos;agent</h2>
          <div className="text-amber-900 whitespace-pre-wrap text-sm leading-relaxed">{mission.revisionFeedback}</div>
          <p className="text-xs text-amber-700 mt-2">Livrez à nouveau la mission ci-dessous ; vos nouvelles preuves remplacent les précédentes.</p>
        </div>
      )}

      {/* Delivered result */}
      {canSeeResult && mission.resultNote && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-1">Résultat livré</h2>
          {mission.deliveredAt && (
            <p className="text-xs text-gray-500 mb-3">
              {new Date(mission.deliveredAt).toLocaleString('fr-FR')}
            </p>
          )}
          <div className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">{mission.resultNote}</div>
          {mission.resultData !== null && (
            <pre className="mt-3 p-3 rounded-lg bg-gray-50 text-xs overflow-x-auto">
              {JSON.stringify(mission.resultData, null, 2)}
            </pre>
          )}
          {proofAttachments.length > 0 && (
            <ul className="mt-3 space-y-1">
              {proofAttachments.map((att) => (
                <li key={att.id}>
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline break-all">
                    📎 {att.filename}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <MissionActions
        mission={{ id: mission.id, status: mission.status, assignedToUserId: mission.assignedToUserId }}
        userId={session.user.id}
        isAssignedToMe={isAssignedToMe}
        stripeConnected={user?.stripeAccountOnboarded ?? false}
        isAdmin={session.user.role === 'ADMIN'}
      />
    </div>
  );
}
