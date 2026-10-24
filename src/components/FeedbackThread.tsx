import { useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { replyToFeedback, type FeedbackEntry } from '../lib/apiClient.ts';

/**
 * Hilo de respuestas debajo de un feedback: lo ven y lo pueden usar tanto quien lo dejó como el
 * buzón (ver canAccessFeedbackThread en server.ts) — este componente no decide permisos, solo
 * los refleja: si el backend deja ver el feedback, también deja responder.
 */
export default function FeedbackThread({ entry, onUpdate }: { entry: FeedbackEntry; onUpdate: (entry: FeedbackEntry) => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    try {
      const { entry: updated } = await replyToFeedback(entry.id, message.trim());
      onUpdate(updated);
      setMessage('');
    } catch (e: any) {
      setError(e.message || 'No se pudo enviar la respuesta.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2">
      {entry.replies.length > 0 && (
        <div className="space-y-2 border-l-2 border-toroto-border pl-3 mb-2">
          {entry.replies.map(r => (
            <div key={r.id}>
              <p className="text-sm text-[#0b1c30]">{r.message}</p>
              <p className="text-xs text-slate-400">
                {r.authorName} · {new Date(r.createdAt).toLocaleString('es-MX')}
              </p>
            </div>
          ))}
        </div>
      )}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-toroto-primary hover:text-toroto-primary-dark"
        >
          <MessageCircle size={13} /> Responder
        </button>
      )}
      {open && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Escribe tu respuesta…"
            autoFocus
            className="flex-1 rounded-lg border border-toroto-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-toroto-primary/20 focus:border-toroto-primary"
          />
          <button
            onClick={send}
            disabled={sending || !message.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-toroto-primary text-white text-xs font-semibold px-3 py-1.5 hover:bg-toroto-primary-dark disabled:opacity-50"
          >
            <Send size={12} /> Enviar
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
