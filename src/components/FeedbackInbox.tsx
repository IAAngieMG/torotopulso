import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteFeedback, fetchFeedbackInbox, type FeedbackEntry, type Me } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';

export default function FeedbackInbox({ me }: { me: Me }) {
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedbackInbox()
      .then(d => setEntries(d.entries))
      .catch(e => setError(e.message));
  }, []);

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este feedback? Ya no se podrá recuperar.')) return;
    setDeletingId(id);
    try {
      await deleteFeedback(id);
      setEntries(prev => prev?.filter(e => e.id !== id) ?? prev);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <TopBar me={me} />
      <div className="p-4 md:p-8 max-w-3xl">
        <h2 className="font-display text-lg font-semibold mb-1">Feedback recibido</h2>
        <p className="text-sm text-slate-500 mb-6">Solo visible para Karla, Samantha y Angie. No se comparte con el resto de la tropa.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!entries && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {entries?.length === 0 && <p className="text-sm text-slate-500">Todavía no hay feedback registrado.</p>}
        <div className="space-y-3">
          {entries?.map(e => (
            <div key={e.id} className="rounded-xl border border-toroto-border bg-white p-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-[#0b1c30]">{e.message}</p>
                <p className="text-xs text-slate-400 mt-2">
                  {e.authorName} · {e.authorEmail} · {new Date(e.createdAt).toLocaleString('es-MX')}
                  {e.view ? ` · desde "${e.view}"` : ''}
                </p>
              </div>
              {me.canDeleteFeedback && (
                <button
                  onClick={() => remove(e.id)}
                  disabled={deletingId === e.id}
                  title="Eliminar (ya solucionado o visto)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
