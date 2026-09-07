import { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, Check, X, Send } from 'lucide-react';
import {
  approveDiploma,
  fetchPendingRecognitions,
  generateDiploma,
  publishRecognitions,
  rejectNomination,
  type Me,
  type Nomination,
} from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';

interface NominationCardProps {
  nomination: Nomination;
  onChanged: () => void;
}

function NominationCard({ nomination, onChanged }: NominationCardProps) {
  const [tone, setTone] = useState<'formal' | 'calido'>(nomination.record?.tone || 'calido');
  const [nomineeName, setNomineeName] = useState(nomination.record?.nomineeName || '');
  const [diplomaText, setDiplomaText] = useState(nomination.record?.diplomaText || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const status = nomination.record?.status || 'pendiente';

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const { record } = await generateDiploma(nomination.id, tone);
      setNomineeName(record.nomineeName);
      setDiplomaText(record.diplomaText);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      await approveDiploma(nomination.id, nomineeName, diplomaText);
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await rejectNomination(nomination.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#0b1c30]">
          {nomination.nominatorName || nomination.nominatorEmail}
        </p>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${
            status === 'aprobado'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : status === 'generado'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-slate-100 text-slate-500'
          }`}
        >
          {status}
        </span>
      </div>
      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{nomination.rawText}</p>

      {(status === 'generado' || status === 'aprobado') && (
        <div className="space-y-2 border-t border-toroto-border pt-3">
          <label className="block text-xs font-medium text-slate-500">Persona reconocida</label>
          <input
            value={nomineeName}
            onChange={e => setNomineeName(e.target.value)}
            className="w-full rounded-lg border border-toroto-border px-3 py-2 text-sm"
            placeholder="Nombre y apellido"
          />
          <label className="block text-xs font-medium text-slate-500">Mención de honor</label>
          <textarea
            value={diplomaText}
            onChange={e => setDiplomaText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-toroto-border px-3 py-2 text-sm"
          />
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tone}
          onChange={e => setTone(e.target.value as 'formal' | 'calido')}
          className="text-xs rounded-lg border border-toroto-border px-2 py-1.5"
          disabled={busy}
        >
          <option value="calido">Tono cálido</option>
          <option value="formal">Tono formal</option>
        </select>
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-toroto-primary text-white px-3 py-1.5 disabled:opacity-50"
        >
          <Sparkles size={13} /> {status === 'pendiente' ? 'Generar diploma con IA' : 'Regenerar con IA'}
        </button>
        {(status === 'generado' || status === 'aprobado') && (
          <button
            onClick={approve}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white px-3 py-1.5 disabled:opacity-50"
          >
            <Check size={13} /> Aprobar diploma
          </button>
        )}
        <button
          onClick={reject}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-toroto-border px-3 py-1.5 text-slate-500 disabled:opacity-50"
        >
          <X size={13} /> Descartar
        </button>
      </div>
    </div>
  );
}

export default function RecognitionsAdmin({ me, onBack }: { me: Me; onBack: () => void }) {
  const [month, setMonth] = useState('');
  const [pending, setPending] = useState<Nomination[] | null>(null);
  const [error, setError] = useState('');
  const [publishMsg, setPublishMsg] = useState('');

  const load = () => {
    fetchPendingRecognitions()
      .then(d => {
        setMonth(d.month);
        setPending(d.pending);
      })
      .catch(e => setError(e.message));
  };

  useEffect(load, []);

  const approvedCount = pending?.filter(n => n.record?.status === 'aprobado').length || 0;

  const publish = async () => {
    try {
      const r = await publishRecognitions();
      setPublishMsg(`Se publicaron ${r.published} diploma(s) para ${r.month}.`);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <TopBar name={me.name} />
      <div className="p-4 md:p-8 space-y-6 max-w-3xl">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver
        </button>
        <div>
          <h2 className="font-display text-lg font-semibold">Reconocimientos del mes · {month}</h2>
          <p className="text-sm text-slate-500">Nominaciones recibidas vía Slack, listas para generar y aprobar su diploma.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!pending && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {pending?.length === 0 && <p className="text-sm text-slate-500">No hay nominaciones pendientes este mes.</p>}

        <div className="space-y-3">
          {pending?.map(n => (
            <NominationCard key={n.id} nomination={n} onChanged={load} />
          ))}
        </div>

        {pending && pending.length > 0 && (
          <div className="rounded-xl border border-toroto-border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">{approvedCount} de {pending.length} diplomas aprobados.</p>
            <button
              onClick={publish}
              disabled={approvedCount === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-toroto-primary text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
            >
              <Send size={14} /> Publicar diplomas del mes
            </button>
          </div>
        )}
        {publishMsg && <p className="text-sm text-emerald-600">{publishMsg}</p>}
      </div>
    </div>
  );
}
