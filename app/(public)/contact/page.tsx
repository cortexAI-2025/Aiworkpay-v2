'use client';

import Navbar from '@/components/Navbar';
import { useState } from 'react';

export default function ContactPage() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('sending');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setState(response.ok ? 'sent' : 'error');
    if (response.ok) event.currentTarget.reset();
  }
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Contactez-nous</h1>
          <p className="text-lg text-gray-600">
            Une question ? Un problème ? Nous sommes là pour vous aider.
          </p>
        </div>

        <div className="card">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Prénom</label>
                <input name="firstName" required maxLength={80} type="text" className="input" placeholder="Jean" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nom</label>
                <input name="lastName" required maxLength={80} type="text" className="input" placeholder="Dupont" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input name="email" required type="email" className="input" placeholder="jean@exemple.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sujet</label>
              <select name="subject" required className="input">
                <option value="">Choisir un sujet...</option>
                <option>Support technique</option>
                <option>Facturation et abonnement</option>
                <option>Intégration API</option>
                <option>Signaler un bug</option>
                <option>Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea
                name="message"
                required
                maxLength={5000}
                className="input min-h-[150px] resize-y"
                placeholder="Décrivez votre demande..."
              />
            </div>
            {state === 'sent' && <p className="text-sm text-green-700">Message envoyé. Nous vous répondrons rapidement.</p>}
            {state === 'error' && <p className="text-sm text-red-700">Envoi impossible. Réessayez ou contactez-nous par email.</p>}
            <button type="submit" disabled={state === 'sending'} className="btn-primary w-full">
              {state === 'sending' ? 'Envoi...' : 'Envoyer le message'}
            </button>
          </form>
        </div>

        <div className="mt-10 grid md:grid-cols-3 gap-6 text-center">
          {[
            { icon: '📧', label: 'Email', value: 'contact@aiworkpay.fr' },
            { icon: '⏱️', label: 'Délai de réponse', value: '< 24h ouvrées' },
            { icon: '💬', label: 'Support', value: 'Email et formulaire' },
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
