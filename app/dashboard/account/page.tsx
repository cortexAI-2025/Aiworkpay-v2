import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import ManageSubscriptionButton from './ManageSubscriptionButton';
import AdminSection from './AdminSection';

export default async function AccountPage() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { subscription: true },
  });

  if (!user) return null;

  const isActive = user.subscription?.status === 'ACTIVE';
  const periodEnd = user.subscription?.currentPeriodEnd;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>

      {/* Profile */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Informations personnelles</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <div className="text-gray-900 font-medium">{user.email}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rôle</label>
            <div className="flex items-center space-x-2">
              <span className="status-badge bg-indigo-100 text-indigo-700">{user.role}</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Membre depuis</label>
            <div className="text-gray-900">{new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

      {/* Subscription */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Abonnement Payworker</h2>

        <div className={`flex items-center justify-between p-4 rounded-xl ${isActive ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <div className={`font-semibold ${isActive ? 'text-green-800' : 'text-red-800'}`}>
                {isActive ? 'Abonnement actif' : 'Abonnement inactif'}
              </div>
              {isActive && periodEnd && (
                <div className="text-green-700 text-sm">
                  Renouvellement le {new Date(periodEnd).toLocaleDateString('fr-FR')}
                </div>
              )}
              {!isActive && (
                <div className="text-red-700 text-sm">
                  Vous ne pouvez pas accepter de missions sans abonnement.
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold text-gray-900">10€</div>
            <div className="text-xs text-gray-500">/mois</div>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          {isActive ? (
            <ManageSubscriptionButton />
          ) : (
            <Link href="/pricing" className="btn-primary flex-1 text-center">
              S&apos;abonner maintenant →
            </Link>
          )}
        </div>
      </div>

      {/* Stripe info */}
      {user.stripeCustomerId && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Paiements</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Stripe Customer ID</span>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                {user.stripeCustomerId}
              </code>
            </div>
          </div>
        </div>
      )}

      {/* Admin section */}
      {session.role === 'ADMIN' && <AdminSection />}

      {/* Danger zone */}
      <div className="card border-red-200">
        <h2 className="font-semibold text-red-700 mb-3">Zone de danger</h2>
        <p className="text-sm text-gray-600 mb-4">
          La suppression de votre compte est irréversible. Toutes vos données seront perdues.
        </p>
        <button className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
          Supprimer mon compte
        </button>
      </div>
    </div>
  );
}
