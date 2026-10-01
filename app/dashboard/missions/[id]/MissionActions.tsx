'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

interface MissionActionsProps {
  mission: {
    id: string;
    status: string;
    assignedToUserId: string | null;
  };
  userId: string;
  isAssignedToMe: boolean;
  stripeConnected: boolean;
  isAdmin: boolean;
}

export default function MissionActions({ mission, isAssignedToMe, stripeConnected, isAdmin }: MissionActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAccept = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/missions/${mission.id}/accept`, { method: 'PUT' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur lors de l'acceptation"); return; }
      setSuccess('Mission acceptée !');
      router.refresh();
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  };

  const [resultNote, setResultNote] = useState('');
  const [proofLinks, setProofLinks] = useState('');

  const handleDeliver = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    // One https link per line, e.g. photos hosted on a shared drive
    const attachments = proofLinks
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url, filename: url.split('/').pop()?.split('?')[0] || url }));
    try {
      const res = await fetch(`/api/missions/${mission.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: resultNote, attachments }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur lors de la livraison'); return; }
      setSuccess('Mission livrée !');
      router.refresh();
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/missions/${mission.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur de mise à jour'); return; }
      setSuccess('Statut mis à jour.');
      router.refresh();
    } catch { setError('Erreur réseau'); }
    finally { setLoading(false); }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
      )}

      {mission.status === 'PUBLISHED' && !isAdmin && (
        <div className="space-y-3">
          {!stripeConnected && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              ⚠️ Configurez votre compte Stripe pour recevoir vos paiements.{' '}
              <Link href="/dashboard/account" className="underline font-medium">Configurer →</Link>
            </div>
          )}
          <button onClick={handleAccept} disabled={loading || !stripeConnected} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Acceptation...' : '✅ Accepter cette mission'}
          </button>
        </div>
      )}

      {isAssignedToMe && mission.status === 'ASSIGNED' && (
        <button onClick={() => handleStatusChange('IN_PROGRESS')} disabled={loading} className="btn-primary w-full">
          {loading ? 'Chargement...' : '▶️ Démarrer la mission'}
        </button>
      )}

      {isAssignedToMe && mission.status === 'IN_PROGRESS' && (
        <form onSubmit={handleDeliver} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Résultat</span>
            <textarea
              value={resultNote}
              onChange={(e) => setResultNote(e.target.value)}
              required
              maxLength={20000}
              rows={6}
              className="input mt-1"
              placeholder="Ce qui a été fait, constaté, avec la date et l'heure."
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Preuves (liens https, un par ligne)</span>
            <textarea
              value={proofLinks}
              onChange={(e) => setProofLinks(e.target.value)}
              rows={3}
              className="input mt-1"
              placeholder="https://..."
            />
          </label>
          <button type="submit" disabled={loading || !resultNote.trim()} className="btn-primary w-full disabled:opacity-50">
            {loading ? 'Envoi...' : '📦 Livrer la mission'}
          </button>
        </form>
      )}

      {mission.status === 'DELIVERED' && (
        isAdmin ? (
          <button onClick={() => handleStatusChange('COMPLETED')} disabled={loading} className="btn-primary w-full">
            {loading ? 'Validation...' : '✓ Valider et payer le Payworker'}
          </button>
        ) : (
          <p className="text-center text-gray-500 text-sm">Mission livrée — en attente de validation.</p>
        )
      )}

      {isAdmin && ['PAYMENT_PENDING', 'PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED'].includes(mission.status) && (
        <button onClick={() => handleStatusChange('CANCELED')} disabled={loading} className="btn-secondary w-full mt-3 text-red-600">
          Annuler et rembourser
        </button>
      )}

      {(mission.status === 'COMPLETED' || mission.status === 'CANCELED') && (
        <p className="text-center text-gray-500 text-sm">Cette mission est terminée.</p>
      )}

      {mission.status === 'PAYMENT_PENDING' && (
        <p className="text-center text-gray-500 text-sm">
          Paiement de l&apos;agent en attente — la mission sera publiée dès confirmation Stripe.
        </p>
      )}
    </div>
  );
}
