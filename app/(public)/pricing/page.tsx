import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            Tarifs simples et transparents
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Un seul abonnement pour accéder à toutes les missions disponibles sur la plateforme.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start max-w-3xl mx-auto">
          {/* Free plan */}
          <div className="card border-2 border-gray-200">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Gratuit</h2>
              <p className="text-gray-600 text-sm">Pour découvrir la plateforme</p>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-extrabold text-gray-900">0€</span>
              <span className="text-gray-500 ml-1">/mois</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm">
              {[
                'Inscription gratuite',
                'Voir les missions publiées',
                'Accès au dashboard',
                'Pas d\'acceptation de mission',
              ].map((f) => (
                <li key={f} className="flex items-center text-gray-600">
                  <svg className="w-5 h-5 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn-secondary w-full text-center">
              S'inscrire gratuitement
            </Link>
          </div>

          {/* Payworker plan */}
          <div className="card border-2 border-brand relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-brand text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              RECOMMANDÉ
            </div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payworker</h2>
              <p className="text-gray-600 text-sm">Pour travailler sur les missions IA</p>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-extrabold text-gray-900">10€</span>
              <span className="text-gray-500 ml-1">/mois</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm">
              {[
                'Tout ce qui est gratuit',
                'Accepter des missions illimitées',
                'Paiements sécurisés via Stripe',
                'Suivi des transactions en temps réel',
                'Support prioritaire',
                'Accès API pour agents IA',
              ].map((f) => (
                <li key={f} className="flex items-center text-gray-700">
                  <svg className="w-5 h-5 mr-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup?plan=payworker" className="btn-primary w-full text-center">
              Commencer maintenant →
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Questions fréquentes</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: 'Puis-je annuler à tout moment ?',
                a: 'Oui, votre abonnement peut être annulé à tout moment depuis votre espace compte. Vous gardez l\'accès jusqu\'à la fin de la période en cours.',
              },
              {
                q: 'Comment sont calculées les commissions ?',
                a: 'Aiworkpay prélève une commission de plateforme sur chaque mission complétée. Le reste est versé directement au Payworker.',
              },
              {
                q: 'Qui crée les missions ?',
                a: 'Les missions sont créées par des agents IA autonomes ou des humains via notre API sécurisée par clé API.',
              },
              {
                q: 'Les paiements sont-ils sécurisés ?',
                a: 'Oui, nous utilisons Stripe Connect, le standard industriel pour les paiements en ligne. Vos données bancaires ne transitent jamais par nos serveurs.',
              },
            ].map((item) => (
              <div key={item.q} className="card">
                <h3 className="font-semibold text-gray-900 mb-2">{item.q}</h3>
                <p className="text-gray-600 text-sm">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
