import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import ConnectPayoutButton from './ConnectPayoutButton';
import AdminSection from './AdminSection';

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      image: true,
      role: true,
      createdAt: true,
      stripeAccountId: true,
      stripeAccountOnboarded: true,
    },
  });

  if (!user) return null;

  const isOnboarded = user.stripeAccountOnboarded;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mon compte</h1>

      {/* Profile */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Informations personnelles</h2>
        <div className="space-y-4">
          {user.image && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={user.image} alt="Avatar" className="w-16 h-16 rounded-full" />
            </div>
          )}
          {user.name && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Nom</label>
              <div className="text-gray-900 font-medium">{user.name}</div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <div className="text-gray-900 font-medium">{user.email}</div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Rôle</label>
            <span className="status-badge bg-indigo-100 text-indigo-700">{user.role}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Membre depuis</label>
            <div className="text-gray-900">
              {new Date(user.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Stripe Connect payout */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Recevoir mes paiements (Stripe Connect)</h2>

        <div className={`flex items-center justify-between p-4 rounded-xl mb-4 ${isOnboarded ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isOnboarded ? 'bg-green-500' : 'bg-amber-500'}`} />
            <div>
              <div className={`font-semibold ${isOnboarded ? 'text-green-800' : 'text-amber-800'}`}>
                {isOnboarded ? 'Compte Stripe connecté ✓' : 'Compte Stripe non configuré'}
              </div>
              <div className={`text-sm ${isOnboarded ? 'text-green-700' : 'text-amber-700'}`}>
                {isOnboarded
                  ? 'Vous recevrez 90 % du budget automatiquement à la validation de chaque mission.'
                  : 'Configurez votre compte pour recevoir 90 % du budget de vos missions.'}
              </div>
            </div>
          </div>
          <div className="text-right ml-4 flex-shrink-0">
            <div className="font-bold text-2xl text-gray-900">90 %</div>
            <div className="text-xs text-gray-500">de chaque mission</div>
          </div>
        </div>

        <ConnectPayoutButton isOnboarded={isOnboarded} hasAccount={!!user.stripeAccountId} />
      </div>

      {/* Admin */}
      {session.user.role === 'ADMIN' && <AdminSection />}

      {/* Danger zone */}
      <div className="card border-red-200">
        <h2 className="font-semibold text-red-700 mb-3">Zone de danger</h2>
        <p className="text-sm text-gray-600 mb-4">
          La suppression de votre compte est irréversible.
        </p>
        <button className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
          Supprimer mon compte
        </button>
      </div>
    </div>
  );
}
