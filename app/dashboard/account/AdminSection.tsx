'use client';
import { useI18n } from '@/components/LanguageProvider';


import { useState, useEffect } from 'react';

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  active: boolean;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  maxMissionBudget: string | null;
  monthlyBudget: string | null;
  createdAt: string;
}






export default function AdminSection() {
  const { t, formatLocale } = useI18n();

const SCOPES: { id: string; label: string }[] = [
  { id: 'missions:read', label: t("Lire ses missions et résultats") },
  { id: 'missions:write', label: t("Créer et annuler des missions") },
  { id: 'missions:approve', label: t("Valider (paie le Payworker) ou demander des corrections") },
];
const optionalNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));
const formatDate = (value: string | null) => (value ? new Date(value).toLocaleDateString(formatLocale) : null);

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<string[]>(['missions:read', 'missions:write']);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [maxMissionBudget, setMaxMissionBudget] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState<{ label: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    const res = await fetch('/api/apikeys');
    if (res.ok) {
      const data = await res.json();
      setKeys(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const toggleScope = (id: string) =>
    setScopes((current) => (current.includes(id) ? current.filter((s) => s !== id) : [...current, id]));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    const res = await fetch('/api/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label,
        scopes,
        expiresInDays: optionalNumber(expiresInDays),
        maxMissionBudget: optionalNumber(maxMissionBudget),
        monthlyBudget: optionalNumber(monthlyBudget),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewKey({ label: data.label, key: data.key });
      setCopied(false);
      setLabel('');
      setExpiresInDays('');
      setMaxMissionBudget('');
      setMonthlyBudget('');
      fetchKeys();
    } else {
      setError(data.error || t("Création impossible"));
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    await fetch(`/api/apikeys/${id}`, { method: 'DELETE' });
    fetchKeys();
  };

  const copyNewKey = () => {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.key);
    setCopied(true);
  };

  return (
    <div className="card border-indigo-200">
      <h2 className="font-semibold text-gray-900 mb-4">
        <span className="status-badge bg-indigo-100 text-indigo-700 mr-2">ADMIN</span>
        {t("Gestion des clés API")}</h2>

      <form onSubmit={handleCreate} className="space-y-3 mb-6">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("Nom de l'agent (ex: Agent GPT-4)")}
          className="input w-full"
          required
        />
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-gray-700 mb-1">Permissions</legend>
          {SCOPES.map((scope) => (
            <label key={scope.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={scopes.includes(scope.id)} onChange={() => toggleScope(scope.id)} />
              <span className="font-mono text-xs">{scope.id}</span> — {scope.label}
            </label>
          ))}
        </fieldset>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-sm text-gray-700">
            {t("Plafond par mission")}<input type="number" min="0.01" step="0.01" value={maxMissionBudget} onChange={(e) => setMaxMissionBudget(e.target.value)} className="input mt-1" placeholder={t('Aucun')} />
          </label>
          <label className="text-sm text-gray-700">
            {t("Budget mensuel")}<input type="number" min="0.01" step="0.01" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} className="input mt-1" placeholder={t('Aucun')} />
          </label>
          <label className="text-sm text-gray-700">
            {t("Expire dans (jours)")}<input type="number" min="1" step="1" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} className="input mt-1" placeholder={t('Jamais')} />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{t(error)}</p>}
        <button type="submit" disabled={creating || scopes.length === 0} className="btn-primary whitespace-nowrap disabled:opacity-50">
          {creating ? '...' : t("+ Créer la clé")}
        </button>
      </form>

      {newKey && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-300">
          <p className="text-sm font-medium text-amber-900 mb-2">
            {t("Clé de «")}{newKey.label} {t("» : copiez-la maintenant, elle ne sera plus jamais affichée.")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-xs break-all bg-white p-2 rounded border border-amber-200">{newKey.key}</code>
            <button type="button" onClick={copyNewKey} className="text-xs text-brand font-medium whitespace-nowrap">
              {copied ? t("✓ Copié") : t("Copier")}
            </button>
            <button type="button" onClick={() => setNewKey(null)} className="text-xs text-gray-500 whitespace-nowrap">
              {t("Masquer")}</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">{t("Chargement...")}</p>
      ) : keys.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">{t("Aucune clé API créée.")}</p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => {
            const expired = k.expiresAt !== null && new Date(k.expiresAt) <= new Date();
            return (
              <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex-1 min-w-0 mr-3">
                  <div className="font-medium text-sm text-gray-900">{k.label}</div>
                  <div className="font-mono text-xs text-gray-500 truncate">{k.keyPrefix}…</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {k.scopes.join(', ')}
                    {k.maxMissionBudget && ` · max ${Number(k.maxMissionBudget)} / mission`}
                    {k.monthlyBudget && ` · ${Number(k.monthlyBudget)} / ${t('mois')}`}
                    {k.expiresAt && ` · ${t('Expire le')} ${formatDate(k.expiresAt)}`}
                    {` · ${k.lastUsedAt ? `${t('Utilisée le')} ${formatDate(k.lastUsedAt)}` : t("jamais utilisée")}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`status-badge ${k.active && !expired ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {!k.active ? t("Révoquée") : expired ? t("Expirée") : 'Active'}
                  </span>
                  {k.active && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      {t("Révoquer")}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
