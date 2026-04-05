import { getSession } from '@/lib/auth';
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
  CREATED: 'Créée', PUBLISHED: 'Publiée', ASSIGNED: 'Assignée',
  IN_PROGRESS: 'En cours', DELIVERED: 'Livrée', COMPLETED: 'Terminée', CANCELED: 'Annulée',
};
const statusColors: Record<string, string> = {
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
  const session = await getSession();
  if (!session) return null;

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
      where: { id: session.sub },
      include: { subscription: true },
    }),
  ]);

  if (!mission) notFound();

  const isAssignedToMe = mission.assignedToUserId === session.sub;
  const isActive = user?.subscription?.status === 'ACTIVE';
  const deadlineDate = new Date(mission.deadline);
  const isOverdue = deadlineDate < new Date();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
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
            <div className="text-sm text-gray-500">Budget</div>
          </div>
        </div>

        <div className="prose max-w-none text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
          {mission.description}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card text-center">
          <div className="text-2xl mb-1">📅</div>
          <div className="text-xs text-gray-500 mb-1">Date limite</div>
          <div className={`font-semibold text-sm ${isOverdue && mission.status !== 'COMPLETED' ? 'text-red-600' : 'text-gray-900'}`}>
            {deadlineDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
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
      {mission.attachments.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Pièces jointes</h2>
          <div className="space-y-2">
            {mission.attachments.map((att) => (
              <a
                key={att.id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-brand hover:bg-brand/5 transition-colors"
              >
                <span className="text-xl mr-3">📎</span>
                <span className="text-sm text-gray-700 flex-1">{att.filename}</span>
                {att.size && (
                  <span className="text-xs text-gray-400">{(att.size / 1024).toFixed(1)} KB</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <MissionActions
        mission={{
          id: mission.id,
          status: mission.status,
          assignedToUserId: mission.assignedToUserId,
        }}
        userId={session.sub}
        isActive={isActive}
        isAssignedToMe={isAssignedToMe}
      />
    </div>
  );
}
