'use client';
import { useState } from 'react';
export default function ActivateAdmin() {
  const [token,setToken] = useState('');
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  return <form className="card space-y-3" onSubmit={async e => {
    e.preventDefault(); setBusy(true);
    try {
      const response = await fetch('/api/admin/bootstrap', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
      const result = await response.json();
      setMessage(response.ok ? 'Administrateur activé. Déconnectez-vous puis reconnectez-vous.' : result.error);
      if(response.ok) setToken('');
    } catch { setMessage('Erreur réseau'); } finally { setBusy(false); }
  }}>
    <h2 className="font-semibold">Activer mon accès administrateur</h2>
    <label className="block">Code d’activation<input type="password" value={token} onChange={e=>setToken(e.target.value)} required autoComplete="off" className="input w-full" /></label>
    <button className="btn-primary" disabled={busy}>{busy ? 'Activation…' : 'Activer'}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}
