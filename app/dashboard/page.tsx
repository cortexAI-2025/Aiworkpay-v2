import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import MissionCard from '@/components/MissionCard';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = session.user.id;

  const [missions, myMissions, transactions, user] = await Promise.all([
    prisma.mission.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: 6,
    }),
    prisma.mission.findMany({
      where: { assignedToUserId: userId, status: { notIn: ['COMPLETED', 'CANCELED'] } },
      orderBy: { updatedAt: 'desc' },
      take: 3,
    }),
    prisma.transaction.findMany({
      where: { userId, type: 'PAYWORKER_PAYOUT', status: 'SUCCEEDED' },
      select: { amount: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { stripeAccountOnboarded: true, stripeAccountId: true },
    }),
  ]);

  const totalEarned = transactions.reduce((acc, t) => acc + Number(t.amount), 0);
  const isConnected = user?.stripeAccountOnboarded ?? false;

  const stats = [
    { label: 'Missions disponibles', value: missions.length, icon: '📋', color: 'bg-blue-50 text-blue-600' },
    { label: 'En cours', value: myMissions.length, icon: '🎯', color: 'bg-purple-50 text-purple-600' },
    { label: 'Total gagné', value: `${totalEarned.toLocaleString('fr-FR')} €`, icon: '💸', color: 'bg-green-50 text-green-600' },
    { label: 'Paiements', value: isConnected ? 'Actifs' : 'À configurer', icon: '⚡', color: isConnected ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonjour 👋</h1>
          <p className="text-gray-500 mt-1">{session.user.email}</p>
        </div>
        <Link href="/dashboard/missions" className="btn-primary mt-4 sm:mt-0">
          Voir les missions →
        </Link>
      </div>

      {/* Stripe Connect banner */}
      {!isConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
          <span className="text-amber-600 text-xl flex-shrink-0">💳</span>
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Configurez vos paiements</p>
            <p className="text-amber-700 text-sm mt-0.5">
              Connectez votre compte Stripe pour recevoir 90 % du budget des missions complétées.{' '}
              <Link href="/dashboard/account" className="underline font-medium">Configurer maintenant →</Link>
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

      {/* My active missions */}
      {myMissions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mes missions en cours</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {myMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={{ ...m, budget: m.budget.toString(), deadline: m.deadline.toISOString() }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available missions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Missions disponibles</h2>
          <Link href="/dashboard/missions" className="text-sm text-brand hover:text-brand-dark font-medium">
            Voir toutes →
          </Link>
        </div>
        {missions.length === 0 ? (
          <div className="card text-center py-10 text-gray-500">Aucune mission disponible pour le moment.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {missions.slice(0, 4).map((m) => (
              <MissionCard
                key={m.id}
                mission={{ ...m, budget: m.budget.toString(), deadline: m.deadline.toISOString() }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
