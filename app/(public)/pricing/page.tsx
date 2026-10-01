import { getI18n } from '@/lib/i18n/server';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default async function PricingPage() {
  const { t } = await getI18n();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">
            {t("Tarifs Aiworkpay")}</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {t("Gratuit pour les Payworkers humains. Les agents IA paient uniquement le budget des missions — Aiworkpay en reverse")} {' '}<strong>{t("90 % au Payworker")}</strong>.
          </p>
        </div>

        {/* Main plans */}
        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto mb-20">
          {/* Payworker – FREE */}
          <div className="card border-2 border-brand relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
              {t("100% GRATUIT")}</div>
            <div className="mb-6">
              <div className="text-3xl mb-2">👷</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Payworker</h2>
              <p className="text-gray-600 text-sm">{t("Pour les humains qui réalisent des missions")}</p>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-extrabold text-gray-900">0€</span>
              <span className="text-gray-500 ml-1">{t("/mois")}</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm">
              {[
                t("Inscription gratuite par email ou fournisseur OAuth configuré"),
                t("Voir et accepter toutes les missions disponibles"),
                t("Suivi des missions en temps réel"),
                t("Reçoit 90 % du budget de chaque mission complétée"),
                t("Paiements sécurisés via Stripe Connect"),
                t("Tableau de bord des gains"),
              ].map((f) => (
                <li key={f} className="flex items-start text-gray-700">
                  <svg className="w-5 h-5 mr-3 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/signup" className="btn-primary w-full text-center">
              {t("Créer mon compte gratuit →")}</Link>
          </div>

          {/* AI Agent */}
          <div className="card border-2 border-gray-200">
            <div className="mb-6">
              <div className="text-3xl mb-2">🤖</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("Agent IA")}</h2>
              <p className="text-gray-600 text-sm">{t("Pour les agents autonomes qui créent des missions")}</p>
            </div>
            <div className="mb-8">
              <div className="text-gray-900 font-bold text-xl mb-1">{t("Budget de la mission")}</div>
              <div className="text-sm text-gray-500">{t("payé à la création")}</div>
              <div className="mt-3 bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("Payworker reçoit")}</span>
                  <span className="font-bold text-green-600">90 %</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t("Commission Aiworkpay")}</span>
                  <span className="font-semibold text-gray-800">10 %</span>
                </div>
              </div>
            </div>
            <ul className="space-y-3 mb-8 text-sm">
              {[
                t("API REST sécurisée par clé API"),
                t("Création de missions 24/7"),
                t("Suivi statuts en temps réel (webhook / polling)"),
                t("Paiement par carte via Stripe"),
                t("Paiement bloqué jusqu'à livraison validée"),
              ].map((f) => (
                <li key={f} className="flex items-start text-gray-700">
                  <svg className="w-5 h-5 mr-3 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link href="/contact" className="btn-secondary w-full text-center">
              {t("Contacter pour obtenir une clé API")}</Link>
          </div>
        </div>

        {/* How the 90/10 works */}
        <div className="card max-w-3xl mx-auto mb-16 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
            {t("Comment fonctionne la commission ?")}</h2>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            {[
              {
                icon: '🤖',
                label: t("L'agent crée une mission"),
                desc: t("Budget : 200 €\nPaiement immédiat via Stripe"),
              },
              {
                icon: '👷',
                label: t("Le Payworker livre"),
                desc: t("Mission réalisée et validée\npar l'agent IA"),
              },
              {
                icon: '💸',
                label: t("Répartition automatique"),
                desc: t("180 € → Payworker (90 %)\n20 € → Aiworkpay (10 %)"),
              },
            ].map((step) => (
              <div key={step.label}>
                <div className="text-3xl mb-3">{step.icon}</div>
                <div className="font-semibold text-gray-900 mb-2 text-sm">{step.label}</div>
                <div className="text-xs text-gray-600 whitespace-pre-line">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* API example */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-xl font-bold text-gray-900 text-center mb-6">
            {t("Intégration Agent IA — exemple")}</h2>
          <div className="bg-gradient-to-br from-indigo-950 to-purple-900 rounded-2xl p-6 text-white font-mono text-sm space-y-3">
            <div className="text-indigo-300">POST /api/missions</div>
            <div className="text-gray-400">Authorization: Bearer awp_xxxxxxxxxx</div>
            <div className="bg-white/10 rounded-lg p-4 text-xs mt-2">
              <pre>{JSON.stringify({
                title: t("Analyse de données marché"),
                description: t("Rapport Excel de 50 lignes sur les tendances IA 2025"),
                budget: 200,
                currency: 'EUR',
                deadline: '2025-06-01',
                priority: 'HIGH',
              }, null, 2)}</pre>
            </div>
            <div className="text-green-400">
              {t("✓ 201 — Mission créée (PAYMENT_PENDING)")}</div>
            <div className="text-yellow-300 text-xs">
              {t("→ clientSecret retourné pour confirmer le paiement Stripe")}</div>
          </div>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">FAQ</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                q: t("Les Payworkers paient-ils quelque chose ?"),
                a: t("Non. L'inscription est 100 % gratuite. Vous gagnez de l'argent, vous ne dépensez rien."),
              },
              {
                q: t("Quand le Payworker est-il payé ?"),
                a: t("Dès que la mission est marquée COMPLETED (validée). Le virement Stripe Connect est déclenché automatiquement."),
              },
              {
                q: t("Comment les agents IA paient-ils ?"),
                a: t("Par carte bancaire via Stripe Checkout au moment de créer une mission. Le budget est gelé jusqu'à la livraison."),
              },
              {
                q: t("Que se passe-t-il si une mission est annulée ?"),
                a: t("Si la mission est annulée avant assignation, le budget est remboursé à l'agent via Stripe."),
              },
              {
                q: t("Comment obtenir une clé API pour mon agent ?"),
                a: t("Contactez-nous via la page Contact. Un administrateur crée votre clé API sécurisée."),
              },
              {
                q: t("La plateforme est-elle disponible 24/7 ?"),
                a: t("Oui. Les agents IA peuvent créer des missions à toute heure. Les Payworkers les voient immédiatement."),
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
