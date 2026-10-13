import { useEffect, useState } from 'react';
import { KeyRound, X, Copy, Trash2 } from 'lucide-react';
import { createApiToken, fetchApiTokens, revokeApiToken, type ApiTokenInfo } from '../lib/apiClient.ts';

/**
 * Autoservicio para generar un token personal de API: permite conectar una herramienta externa
 * (ej. un asistente propio) a GET /api/me y GET /api/pulse/* con el mismo alcance que la persona
 * ya ve en el dashboard. El token crudo solo se muestra una vez, justo después de crearlo.
 */
export default function ApiTokensModal({ onClose }: { onClose: () => void }) {
  const [tokens, setTokens] = useState<ApiTokenInfo[] | null>(null);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [error, setError] = useState('');

  const reload = () => fetchApiTokens().then(d => setTokens(d.tokens)).catch(e => setError(e.message));

  useEffect(() => {
    reload();
  }, []);

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      const result = await createApiToken(label.trim());
      setJustCreated(result.token);
      setLabel('');
      await reload();
    } catch (e: any) {
      setError(e.message || 'No fue posible crear el token.');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    try {
      await revokeApiToken(id);
      await reload();
    } catch (e: any) {
      setError(e.message || 'No fue posible revocar el token.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white border border-toroto-border p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-toroto-primary" />
            <h2 className="font-display font-semibold text-sm">Acceso API</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Genera un token para que una herramienta externa (por ejemplo tu propio asistente) lea tus datos de Pulso
          (<code className="bg-slate-100 rounded px-1">GET /api/me</code> y{' '}
          <code className="bg-slate-100 rounded px-1">GET /api/pulse/*</code>) con el mismo alcance que ya ves en
          este dashboard. No permite crear, editar ni borrar nada.
        </p>

        {justCreated && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-800 mb-1">
              Copia este token ahora — no se vuelve a mostrar.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all bg-white rounded border border-emerald-200 px-2 py-1.5">{justCreated}</code>
              <button
                onClick={() => navigator.clipboard.writeText(justCreated).catch(() => {})}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-emerald-200 px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <Copy size={12} /> Copiar
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Para qué lo vas a usar (ej. Brief semanal)"
            className="flex-1 rounded-lg border border-toroto-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-toroto-primary/20 focus:border-toroto-primary"
          />
          <button
            onClick={create}
            disabled={creating}
            className="inline-flex items-center justify-center rounded-lg bg-toroto-primary text-white text-sm font-semibold px-4 py-2 hover:bg-toroto-primary-dark disabled:opacity-50"
          >
            Crear
          </button>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <div className="space-y-2 max-h-56 overflow-y-auto">
          {tokens === null && <p className="text-xs text-slate-400">Cargando…</p>}
          {tokens?.length === 0 && <p className="text-xs text-slate-400">Aún no tienes tokens.</p>}
          {tokens?.map(t => (
            <div key={t.id} className="flex items-center justify-between rounded-lg border border-toroto-border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.label}</p>
                <p className="text-[11px] text-slate-400">
                  Creado {new Date(t.createdAt).toLocaleDateString('es-MX')}
                  {t.lastUsedAt ? ` · Usado por última vez ${new Date(t.lastUsedAt).toLocaleDateString('es-MX')}` : ' · Sin usar'}
                </p>
              </div>
              <button onClick={() => revoke(t.id)} className="shrink-0 text-slate-400 hover:text-red-600" title="Revocar">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
