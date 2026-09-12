import { useEffect, useState } from 'react';
import { fetchFeedbackInbox, type FeedbackEntry, type Me } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';

export default function FeedbackInbox({ me }: { me: Me }) {
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFeedbackInbox()
      .then(d => setEntries(d.entries))
      .catch(e => setError(e.message));
  }, []);

  return (
    <div>
      <TopBar me={me} />
      <div className="p-4 md:p-8 max-w-3xl">
        <h2 className="font-display text-lg font-semibold mb-1">Feedback recibido</h2>
        <p className="text-sm text-slate-500 mb-6">Solo visible para Karla y Angie. No se comparte con el resto de la tropa.</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!entries && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {entries?.length === 0 && <p className="text-sm text-slate-500">Todavía no hay feedback registrado.</p>}
        <div className="space-y-3">
          {entries?.map(e => (
            <div key={e.id} className="rounded-xl border border-toroto-border bg-white p-4">
              <p className="text-sm text-[#0b1c30]">{e.message}</p>
              <p className="text-xs text-slate-400 mt-2">
                {e.authorName} · {e.authorEmail} · {new Date(e.createdAt).toLocaleString('es-MX')}
                {e.view ? ` · desde "${e.view}"` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
