import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const typeLabels: Record<string, string> = {
  SUBSCRIPTION: 'Abonnement',
  MISSION_PAYOUT: 'Paiement mission',
  PLATFORM_FEE: 'Commission plateforme',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SUCCEEDED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  PENDING: 'En attente',
  SUCCEEDED: 'Réussi',
  FAILED: 'Échoué',
};

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) return null;

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: 'desc' },
    include: { mission: { select: { title: true } } },
  });

  const totalEarned = transactions
    .filter((t) => t.status === 'SUCCEEDED' && t.type === 'MISSION_PAYOUT')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Total gagné</div>
          <div className="text-2xl font-bold text-green-600">{totalEarned.toLocaleString('fr-FR')} €</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">Transactions</div>
          <div className="text-2xl font-bold text-gray-900">{transactions.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500 mb-1">En attente</div>
          <div className="text-2xl font-bold text-yellow-600">
            {transactions.filter((t) => t.status === 'PENDING').length}
          </div>
        </div>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">💳</div>
          <p className="text-gray-500">Aucune transaction pour le moment.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-700">Type</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-700">Mission</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-700">Montant</th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-700">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(t.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {typeLabels[t.type] || t.type}
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-[200px] truncate">
                      {t.mission?.title || '—'}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {Number(t.amount).toLocaleString('fr-FR')} {t.currency}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`status-badge ${statusColors[t.status]}`}>
                        {statusLabels[t.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
