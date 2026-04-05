'use client';

import { useState, useEffect } from 'react';

interface ApiKey {
  id: string;
  key: string;
  label: string;
  active: boolean;
  createdAt: string;
}

export default function AdminSection() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    if (res.ok) {
      setLabel('');
      fetchKeys();
    }
    setCreating(false);
  };

  const handleRevoke = async (id: string) => {
    await fetch(`/api/apikeys/${id}`, { method: 'DELETE' });
    fetchKeys();
  };

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="card border-indigo-200">
      <h2 className="font-semibold text-gray-900 mb-4">
        <span className="status-badge bg-indigo-100 text-indigo-700 mr-2">ADMIN</span>
        Gestion des clés API
      </h2>

      <form onSubmit={handleCreate} className="flex gap-3 mb-6">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nom de l'agent (ex: Agent GPT-4)"
          className="input flex-1"
          required
        />
        <button type="submit" disabled={creating} className="btn-primary whitespace-nowrap">
          {creating ? '...' : '+ Créer'}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Chargement...</p>
      ) : keys.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">Aucune clé API créée.</p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex-1 min-w-0 mr-3">
                <div className="font-medium text-sm text-gray-900">{k.label}</div>
                <div className="font-mono text-xs text-gray-500 truncate">{k.key}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`status-badge ${k.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {k.active ? 'Active' : 'Révoquée'}
                </span>
                <button
                  onClick={() => copyToClipboard(k.key, k.id)}
                  className="text-xs text-brand hover:text-brand-dark font-medium"
                >
                  {copiedId === k.id ? '✓ Copié' : 'Copier'}
                </button>
                {k.active && (
                  <button
                    onClick={() => handleRevoke(k.id)}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Révoquer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
