'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (token && password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    const res = await fetch(token ? '/api/auth/password/reset' : '/api/auth/password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(token ? { token, password } : { email }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Une erreur est survenue.');
      return;
    }
    setSubmitted(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{token ? 'Nouveau mot de passe' : 'Mot de passe oublié'}</h1>
        <p className="text-gray-500 text-sm">
          {token ? 'Choisissez un mot de passe sécurisé' : 'Saisissez votre email pour recevoir un lien de réinitialisation'}
        </p>
      </div>

      {submitted ? (
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">{token ? 'Mot de passe modifié !' : 'Demande enregistrée'}</h2>
          <p className="text-gray-600 text-sm mb-6">
            {token ? 'Vous pouvez maintenant vous connecter.' : 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation sous peu.'}
          </p>
          <Link href="/login" className="btn-primary inline-flex">
            Retour à la connexion
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            {!token ? <div>
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
            </div> : <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe</label>
                <input type="password" minLength={8} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} className="input" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer le mot de passe</label>
                <input type="password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" autoComplete="new-password" />
              </div>
            </>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Traitement...' : token ? 'Enregistrer le mot de passe' : 'Envoyer le lien de réinitialisation'}
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
