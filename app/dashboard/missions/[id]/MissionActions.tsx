'use client';
import { useI18n } from '@/components/LanguageProvider';


import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';

interface UploadedProof {
  id: string;
  filename: string;
  mimeType: string | null;
  size: number | null;
}



interface MissionActionsProps {
  mission: {
    id: string;
    status: string;
    assignedToUserId: string | null;
  };
  userId: string;
  /** Files already uploaded by the assignee for this mission */
  uploadedProofs: UploadedProof[];
  isAssignedToMe: boolean;
  stripeConnected: boolean;
  isAdmin: boolean;
}

export default function MissionActions({ mission, uploadedProofs, isAssignedToMe, stripeConnected, isAdmin }: MissionActionsProps) {
  const { t } = useI18n();

const ACCEPTED_FILES = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

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
      if (!res.ok) { setError(data.error || t("Erreur lors de l'acceptation")); return; }
      setSuccess(t("Mission acceptée !"));
      router.refresh();
    } catch { setError(t("Erreur réseau")); }
    finally { setLoading(false); }
  };

  const [resultNote, setResultNote] = useState('');
  const [files, setFiles] = useState<UploadedProof[]>(uploadedProofs);
  const [uploading, setUploading] = useState(false);

  // One request per file, so that a failure names the file concerned
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.length === 0) return;
    setUploading(true);
    setError('');
    for (const file of selected) {
      const body = new FormData();
      body.append('file', file);
      try {
        const res = await fetch(`/api/missions/${mission.id}/proofs`, { method: 'POST', body });
        const data = await res.json();
        if (!res.ok) {
          setError(`${file.name} : ${data.error || t("envoi impossible")}`);
          continue;
        }
        setFiles((current) => [...current, { id: data.id, filename: data.filename, mimeType: data.mimeType, size: data.size }]);
      } catch {
        setError(`${file.name} : ${t("Erreur réseau")}`);
      }
    }
    setUploading(false);
  };

  const handleRemoveFile = async (id: string) => {
    setError('');
    const res = await fetch(`/api/missions/${mission.id}/proofs/${id}`, { method: 'DELETE' });
    if (res.ok) setFiles((current) => current.filter((f) => f.id !== id));
    else setError((await res.json()).error || t("Suppression impossible"));
  };
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
      if (!res.ok) { setError(data.error || t("Erreur lors de la livraison")); return; }
      setSuccess(t("Mission livrée !"));
      router.refresh();
    } catch { setError(t("Erreur réseau")); }
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
      if (!res.ok) { setError(data.error || t("Erreur de mise à jour")); return; }
      setSuccess(t("Statut mis à jour."));
      router.refresh();
    } catch { setError(t("Erreur réseau")); }
    finally { setLoading(false); }
  };

  return (
    <div className="card">
      <h2 className="font-semibold text-gray-900 mb-4">Actions</h2>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{t(error)}</div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{success}</div>
      )}

      {mission.status === 'PUBLISHED' && !isAdmin && (
        <div className="space-y-3">
          {!stripeConnected && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              {t("⚠️ Configurez votre compte Stripe pour recevoir vos paiements.")}{' '}
              <Link href="/dashboard/account" className="underline font-medium">{t("Configurer →")}</Link>
            </div>
          )}
          <button onClick={handleAccept} disabled={loading || !stripeConnected} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Acceptation...' : t("✅ Accepter cette mission")}
          </button>
        </div>
      )}

      {isAssignedToMe && mission.status === 'ASSIGNED' && (
        <button onClick={() => handleStatusChange('IN_PROGRESS')} disabled={loading} className="btn-primary w-full">
          {loading ? t("Chargement...") : t("▶️ Démarrer la mission")}
        </button>
      )}

      {isAssignedToMe && mission.status === 'IN_PROGRESS' && (
        <form onSubmit={handleDeliver} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("Résultat")}</span>
            <textarea
              value={resultNote}
              onChange={(e) => setResultNote(e.target.value)}
              required
              maxLength={20000}
              rows={6}
              className="input mt-1"
              placeholder={t("Ce qui a été fait, constaté, avec la date et l'heure.")}
            />
          </label>
          <div>
            <span className="text-sm font-medium text-gray-700">{t("Fichiers (photos, PDF — 10 Mo max. chacun)")}</span>
            <input
              type="file"
              multiple
              accept={ACCEPTED_FILES}
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full text-sm mt-1"
            />
            {uploading && <p className="text-xs text-gray-500 mt-1">{t("Envoi en cours…")}</p>}
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center justify-between text-sm">
                    <a href={`/api/missions/${mission.id}/proofs/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-brand underline truncate">
                      📎 {f.filename}
                    </a>
                    <button type="button" onClick={() => handleRemoveFile(f.id)} className="text-xs text-red-600 ml-2">
                      {t("Retirer")}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{t("Autres preuves (liens https, un par ligne)")}</span>
            <textarea
              value={proofLinks}
              onChange={(e) => setProofLinks(e.target.value)}
              rows={3}
              className="input mt-1"
              placeholder="https://..."
            />
          </label>
          <button type="submit" disabled={loading || uploading || !resultNote.trim()} className="btn-primary w-full disabled:opacity-50">
            {loading ? t("Envoi...") : t("📦 Livrer la mission")}
          </button>
        </form>
      )}

      {mission.status === 'DELIVERED' && (
        isAdmin ? (
          <button onClick={() => handleStatusChange('COMPLETED')} disabled={loading} className="btn-primary w-full">
            {loading ? 'Validation...' : t("✓ Valider et payer le Payworker")}
          </button>
        ) : (
          <p className="text-center text-gray-500 text-sm">{t("Mission livrée — en attente de validation.")}</p>
        )
      )}

      {isAdmin && ['PAYMENT_PENDING', 'PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'DELIVERED'].includes(mission.status) && (
        <button onClick={() => handleStatusChange('CANCELED')} disabled={loading} className="btn-secondary w-full mt-3 text-red-600">
          {t("Annuler et rembourser")}</button>
      )}

      {(mission.status === 'COMPLETED' || mission.status === 'CANCELED') && (
        <p className="text-center text-gray-500 text-sm">{t("Cette mission est terminée.")}</p>
      )}

      {mission.status === 'PAYMENT_PENDING' && (
        <p className="text-center text-gray-500 text-sm">
          {t("Paiement de l'agent en attente — la mission sera publiée dès confirmation Stripe.")}</p>
      )}
    </div>
  );
}
