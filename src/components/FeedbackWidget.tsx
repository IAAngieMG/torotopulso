import { useState } from 'react';
import { Heart, Send } from 'lucide-react';
import { sendFeedback } from '../lib/apiClient.ts';

export default function FeedbackWidget({ view }: { view: string }) {
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      await sendFeedback(message.trim(), view);
      setMessage('');
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4">
      <div className="flex items-center gap-2 mb-1">
        <Heart size={16} className="text-toroto-primary" />
        <p className="font-display font-semibold text-sm">Ayúdanos a mejorar Pulso</p>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Este dashboard está creciendo contigo. Si encuentras algo que podríamos mejorar, tienes una idea o hay
        información que te gustaría visualizar, cuéntanos.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Tengo una idea, encontré algo que podemos mejorar…"
          className="flex-1 rounded-lg border border-toroto-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-toroto-primary/20 focus:border-toroto-primary"
        />
        <button
          onClick={submit}
          disabled={status === 'sending' || !message.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-toroto-primary text-white text-sm font-semibold px-4 py-2 hover:bg-toroto-primary-dark disabled:opacity-50"
        >
          <Send size={14} /> Enviar feedback
        </button>
      </div>
      {status === 'sent' && <p className="text-xs text-emerald-600 mt-2">¡Gracias! Tu feedback fue enviado.</p>}
      {status === 'error' && <p className="text-xs text-red-600 mt-2">No se pudo enviar, intenta de nuevo.</p>}
      <p className="text-[11px] text-slate-400 mt-2">
        Tu nombre, correo y la vista actual se adjuntan automáticamente para que no tengas que escribirlos.
      </p>
    </div>
  );
}
