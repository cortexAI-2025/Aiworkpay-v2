'use client';
import { useI18n } from '@/components/LanguageProvider';


import { useState } from 'react';

interface Props {
  isOnboarded: boolean;
  hasAccount: boolean;
}

export default function ConnectPayoutButton({ isOnboarded, hasAccount }: Props) {
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/connect-account', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      console.error('Connect error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/payments/connect-account');
      const data = await res.json();
      if (data.onboarded) {
        window.location.reload();
      } else {
        alert(t("Votre compte Stripe n'est pas encore validé. Veuillez compléter l'onboarding."));
      }
    } catch {
      console.error('Status check error');
    } finally {
      setChecking(false);
    }
  };

  if (isOnboarded) {
    return (
      <div className="flex gap-3">
        <button onClick={handleConnect} disabled={loading} className="btn-secondary flex-1">
          {loading ? t("Chargement...") : t("⚙️ Gérer mon compte Stripe")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <button onClick={handleConnect} disabled={loading} className="btn-primary flex-1">
        {loading ? t("Chargement...") : t("💳 Configurer mes paiements Stripe →")}
      </button>
      {hasAccount && (
        <button onClick={handleCheckStatus} disabled={checking} className="btn-secondary px-4">
          {checking ? '...' : '🔄'}
        </button>
      )}
    </div>
  );
}
