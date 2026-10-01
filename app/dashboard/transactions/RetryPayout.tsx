'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export default function RetryPayout({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function retry() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/missions/${encodeURIComponent(missionId)}/retry-payout`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Virement indisponible');
      setMessage(result.status === 'SUCCEEDED' ? 'Transfert effectué' : result.reason === 'CONNECT_NOT_READY' ? 'Le compte Stripe du Payworker doit être activé.' : 'Transfert toujours en attente.');
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Erreur réseau'); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={retry} className="text-sm text-indigo-700 underline disabled:opacity-50">{busy ? 'Vérification…' : 'Reprendre le virement'}</button>{message && <p role="status" className="text-xs mt-1">{message}</p>}</div>;
}
