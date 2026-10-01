'use client';
import { useI18n } from '@/components/LanguageProvider';


import Navbar from '@/components/Navbar';
import { useState } from 'react';

export default function ContactPage() {
  const { t } = useI18n();

  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    const element = event.currentTarget;
    const form = new FormData(element);
    try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setState(response.ok ? 'sent' : 'error');
    if (response.ok) element.reset();
    } catch { setState('error'); }
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t("Contactez-nous")}</h1>
          <p className="text-lg text-gray-600">
            {t("Une question ? Un problème ? Nous sommes là pour vous aider.")}</p>
        </div>

        <div className="card">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("Prénom")}</label>
                <input name="firstName" required maxLength={80} type="text" className="input" placeholder={t("Jean")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t("Nom")}</label>
                <input name="lastName" required maxLength={80} type="text" className="input" placeholder={t("Dupont")} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input name="email" required type="email" className="input" placeholder={t("jean@exemple.com")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("Sujet")}</label>
              <select name="subject" required className="input">
                <option value="">{t("Choisir un sujet...")}</option>
                <option>{t("Support technique")}</option>
                <option>{t("Facturation et abonnement")}</option>
                <option>{t("Intégration API")}</option>
                <option>{t("Signaler un bug")}</option>
                <option>{t("Autre")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                name="message"
                required
                maxLength={5000}
                className="input min-h-[150px] resize-y"
                placeholder={t("Décrivez votre demande...")}
              />
            </div>
            {state === 'sent' && <p className="text-sm text-green-700">{t("Message envoyé. Nous vous répondrons rapidement.")}</p>}
            {state === 'error' && <p className="text-sm text-red-700">{t("Envoi impossible. Réessayez ou contactez-nous par email.")}</p>}
            <button type="submit" disabled={state === 'sending'} className="btn-primary w-full">
              {state === 'sending' ? t("Envoi...") : t("Envoyer le message")}
            </button>
          </form>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-6 text-center">
          {[
            { icon: '📧', label: 'Email', value: 'contact@aiworkpay.fr' },
            { icon: '⏱️', label: t("Délai de réponse"), value: t("< 24h ouvrées") },
            { icon: '💬', label: 'Support', value: t("Email et formulaire") },
          ].map((item) => (
            <div key={item.label} className="card text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <div className="text-sm font-medium text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-500 mt-1">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
