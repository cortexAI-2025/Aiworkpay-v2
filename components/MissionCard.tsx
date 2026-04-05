import Link from 'next/link';

interface MissionCardProps {
  mission: {
    id: string;
    title: string;
    description: string;
    budget: string | number;
    currency: string;
    deadline: string | Date;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    status: string;
  };
  showLink?: boolean;
}

const priorityBadge = {
  LOW: 'badge-low',
  MEDIUM: 'badge-medium',
  HIGH: 'badge-high',
};

const priorityLabel = {
  LOW: 'Faible',
  MEDIUM: 'Moyen',
  HIGH: 'Haute',
};

const statusColors: Record<string, string> = {
  CREATED: 'bg-gray-100 text-gray-700',
  PUBLISHED: 'bg-blue-100 text-blue-700',
  ASSIGNED: 'bg-purple-100 text-purple-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  DELIVERED: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  CREATED: 'Créée',
  PUBLISHED: 'Publiée',
  ASSIGNED: 'Assignée',
  IN_PROGRESS: 'En cours',
  DELIVERED: 'Livrée',
  COMPLETED: 'Terminée',
  CANCELED: 'Annulée',
};

export default function MissionCard({ mission, showLink = true }: MissionCardProps) {
  const deadlineDate = new Date(mission.deadline);
  const isOverdue = deadlineDate < new Date() && mission.status !== 'COMPLETED' && mission.status !== 'CANCELED';

  return (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-lg">{mission.title}</h3>
        </div>
        <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
          <span className={priorityBadge[mission.priority]}>
            {priorityLabel[mission.priority]}
          </span>
          <span className={`status-badge ${statusColors[mission.status] || 'bg-gray-100 text-gray-700'}`}>
            {statusLabels[mission.status] || mission.status}
          </span>
        </div>
      </div>

      <p className="text-gray-600 text-sm line-clamp-2 mb-4">{mission.description}</p>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center text-green-600 font-semibold">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {Number(mission.budget).toLocaleString('fr-FR')} {mission.currency}
          </div>
          <div className={`flex items-center ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {deadlineDate.toLocaleDateString('fr-FR')}
            {isOverdue && ' (dépassée)'}
          </div>
        </div>
        {showLink && (
          <Link
            href={`/dashboard/missions/${mission.id}`}
            className="text-brand hover:text-brand-dark font-medium transition-colors"
          >
            Voir →
          </Link>
        )}
      </div>
    </div>
  );
}
