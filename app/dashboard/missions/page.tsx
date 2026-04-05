import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import MissionCard from '@/components/MissionCard';
import Link from 'next/link';

interface SearchParams {
  status?: string;
  priority?: string;
  minBudget?: string;
  currency?: string;
}

export default async function MissionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) return null;

  const params = await searchParams;

  const where: Record<string, unknown> = {};

  if (params.status) {
    where.status = params.status;
  } else {
    where.status = { in: ['PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED'] };
  }

  if (params.priority) {
    where.priority = params.priority;
  }

  if (params.minBudget) {
    where.budget = { gte: parseFloat(params.minBudget) };
  }

  const missions = await prisma.mission.findMany({
    where,
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Missions</h1>
        <span className="text-sm text-gray-500">{missions.length} mission{missions.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="card">
        <form className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
            <select name="status" defaultValue={params.status || ''} className="input py-2 text-sm">
              <option value="">Tous</option>
              <option value="PUBLISHED">Publiée</option>
              <option value="ASSIGNED">Assignée</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="DELIVERED">Livrée</option>
              <option value="COMPLETED">Terminée</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priorité</label>
            <select name="priority" defaultValue={params.priority || ''} className="input py-2 text-sm">
              <option value="">Toutes</option>
              <option value="HIGH">Haute</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="LOW">Faible</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Budget min. (€)</label>
            <input
              type="number"
              name="minBudget"
              defaultValue={params.minBudget || ''}
              placeholder="0"
              min="0"
              className="input py-2 text-sm w-32"
            />
          </div>
          <button type="submit" className="btn-primary py-2 px-4 text-sm">
            Filtrer
          </button>
          <Link href="/dashboard/missions" className="btn-secondary py-2 px-4 text-sm">
            Réinitialiser
          </Link>
        </form>
      </div>

      {/* Missions grid */}
      {missions.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-gray-500 text-lg">Aucune mission ne correspond à vos filtres.</p>
          <Link href="/dashboard/missions" className="text-brand hover:text-brand-dark mt-2 inline-block">
            Voir toutes les missions
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
  );
}
