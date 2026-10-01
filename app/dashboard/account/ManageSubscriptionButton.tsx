'use client';
import { useI18n } from '@/components/LanguageProvider';


import { useState } from 'react';

export default function ManageSubscriptionButton() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(false);

  const handleManage = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payments/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      console.error('Failed to open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleManage}
      disabled={loading}
      className="btn-secondary flex-1"
    >
      {loading ? t("Chargement...") : t("⚙️ Gérer mon abonnement")}
    </button>
  );
}
