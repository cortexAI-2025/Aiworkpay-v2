'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // In production, send a reset email via your email provider
    setSubmitted(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe oublié</h1>
        <p className="text-gray-500 text-sm">
          Saisissez votre email pour recevoir un lien de réinitialisation
        </p>
      </div>

      {submitted ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Email envoyé !</h2>
          <p className="text-gray-600 text-sm mb-6">
            Si un compte existe avec cet email, vous recevrez un lien de réinitialisation sous peu.
          </p>
          <Link href="/login" className="btn-primary inline-flex">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="vous@exemple.com"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Envoyer le lien de réinitialisation
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6">
            <Link href="/login" className="text-brand hover:text-brand-dark transition-colors">
              ← Retour à la connexion
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
