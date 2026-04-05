import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import MissionCard from '@/components/MissionCard';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const [user, missions, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.sub },
      include: { subscription: true },
    }),
    prisma.mission.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.transaction.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const myMissions = await prisma.mission.findMany({
    where: { assignedToUserId: session.sub },
    orderBy: { updatedAt: 'desc' },
    take: 3,
  });

  const isActive = user?.subscription?.status === 'ACTIVE';

  const stats = [
    {
      label: 'Missions disponibles',
      value: missions.length,
      icon: '📋',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Mes missions',
      value: myMissions.length,
      icon: '🎯',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Transactions',
      value: transactions.length,
      icon: '💸',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Abonnement',
      value: isActive ? 'Actif' : 'Inactif',
      icon: '⚡',
      color: isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour 👋
          </h1>
          <p className="text-gray-500 mt-1">{session.email}</p>
        </div>
        {!isActive && (
          <Link href="/pricing" className="btn-primary mt-4 sm:mt-0">
            Activer mon abonnement
          </Link>
        )}
      </div>

      {/* Subscription alert */}
      {!isActive && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
          <span className="text-amber-600 text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">Abonnement inactif</p>
            <p className="text-amber-700 text-sm mt-0.5">
              Vous devez avoir un abonnement actif pour accepter des missions.{' '}
              <Link href="/pricing" className="underline font-medium">S&apos;abonner pour 10€/mois →</Link>
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
              <span className="text-xl">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Recent missions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Dernières missions disponibles</h2>
          <Link href="/dashboard/missions" className="text-sm text-brand hover:text-brand-dark font-medium">
            Voir toutes →
          </Link>
        </div>
        {missions.length === 0 ? (
          <div className="card text-center py-10 text-gray-500">
            Aucune mission disponible pour le moment.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {missions.map((m) => (
              <MissionCard
                key={m.id}
                mission={{
                  ...m,
                  budget: m.budget.toString(),
                  deadline: m.deadline.toISOString(),
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* My active missions */}
      {myMissions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Mes missions en cours</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {myMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={{
                  ...m,
                  budget: m.budget.toString(),
                  deadline: m.deadline.toISOString(),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
