'use client';
import { useI18n } from '@/components/LanguageProvider';

import { useState } from 'react';
export default function ActivateAdmin() {
  const { t } = useI18n();

  const [token,setToken] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  return <form className="card space-y-3" onSubmit={async e => {
    e.preventDefault(); setBusy(true);
    try {
      const response = await fetch('/api/admin/bootstrap', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
      const result = await response.json();
      setMessage(response.ok ? t("Administrateur activé. Déconnectez-vous puis reconnectez-vous.") : result.error);
      if(response.ok) setToken('');
    } catch { setMessage(t("Erreur réseau")); } finally { setBusy(false); }
  }}>
    <h2 className="font-semibold">{t("Activer mon accès administrateur")}</h2>
    <label className="block">{t("Code d’activation")}<input type="password" value={token} onChange={e=>setToken(e.target.value)} required autoComplete="off" className="input w-full" /></label>
    <button className="btn-primary" disabled={busy}>{busy ? t("Activation…") : t("Activer")}</button>
    {message && <p role="status">{t(message)}</p>}
  </form>;
}
