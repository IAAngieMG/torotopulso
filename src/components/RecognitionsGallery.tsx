import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarClock, Send } from 'lucide-react';
import { fetchPublishedRecognitions, scheduleLaunch, type Me, type RecognitionRecord } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';
import DiplomaCard from './DiplomaCard.tsx';

const PREVIEW_NAMES = ['Santiago', 'Ane', 'Patricia'];

function LaunchScheduler() {
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const submit = async () => {
    if (!date) return;
    setStatus('sending');
    try {
      await scheduleLaunch(new Date(date).toISOString(), label);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock size={16} className="text-toroto-primary" />
        <p className="font-display font-semibold text-sm">Programador de lanzamiento</p>
      </div>
      <p className="text-xs text-slate-500">
        Programa cuándo se lanza el próximo ciclo de reconocimientos. Angie y Karla recibirán la solicitud para generar y aprobar los diplomas.
      </p>
      <input
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder="Ej. Lanzar ciclo de reconocimientos Fiestas Patrias Septiembre"
        className="w-full rounded-lg border border-toroto-border px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <input
          type="datetime-local"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="rounded-lg border border-toroto-border px-3 py-2 text-sm"
        />
        <button
          onClick={submit}
          disabled={!date || status === 'sending'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-toroto-primary text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
        >
          <Send size={14} /> Programar lanzamiento
        </button>
      </div>
      {status === 'sent' && <p className="text-xs text-emerald-600">Listo — Angie y Karla ya pueden verla.</p>}
      {status === 'error' && <p className="text-xs text-red-600">No se pudo enviar la solicitud.</p>}
    </div>
  );
}

export default function RecognitionsGallery({ me, onBack }: { me: Me; onBack: () => void }) {
  const [month, setMonth] = useState('');
  const [diplomas, setDiplomas] = useState<RecognitionRecord[] | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [previewAs, setPreviewAs] = useState('');

  useEffect(() => {
    fetchPublishedRecognitions()
      .then(d => {
        setMonth(d.month);
        setDiplomas(d.diplomas);
      })
      .catch(e => setError(e.message));
  }, []);

  const displayName = previewAs || me.name;
  const current = diplomas?.[index];
  const isSantiago = me.email === 'santiago@toroto.mx';

  return (
    <div>
      <TopBar me={{ ...me, name: displayName }} />
      <div className="p-4 md:p-8 space-y-6 max-w-2xl">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Reconocimientos del mes · {month}</h2>
            <p className="text-sm text-slate-500">Diplomas publicados para toda la tropa.</p>
          </div>
          {me.canManageRecognitions && (
            <select
              value={previewAs}
              onChange={e => setPreviewAs(e.target.value)}
              className="text-xs rounded-lg border border-toroto-border px-2.5 py-1.5 bg-white"
              title="Ver esta pantalla como otro perfil, solo para verificar"
            >
              <option value="">Ver como tú misma</option>
              {PREVIEW_NAMES.map(n => (
                <option key={n} value={n}>
                  Ver como {n}
                </option>
              ))}
            </select>
          )}
        </div>

        {isSantiago && <LaunchScheduler />}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!diplomas && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {diplomas?.length === 0 && (
          <div className="rounded-xl border border-toroto-border bg-white p-8 text-center text-sm text-slate-500">
            Aún no hay diplomas publicados este mes.
          </div>
        )}

        {current && (
          <div className="rounded-xl border border-toroto-border bg-white p-6">
            <DiplomaCard
              nomineeName={current.nomineeName}
              nomineeRole={current.nomineeRole}
              mention={current.diplomaText}
              month={current.month}
            />
            <p className="text-xs text-slate-400 mt-3 text-center">
              Nominado por {current.nominatorName || current.nominatorEmail}
            </p>

            {diplomas && diplomas.length > 1 && (
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setIndex(i => Math.max(0, i - 1))}
                  disabled={index === 0}
                  className="p-2 rounded-lg border border-toroto-border disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-xs text-slate-500">
                  {index + 1} de {diplomas.length}
                </p>
                <button
                  onClick={() => setIndex(i => Math.min(diplomas.length - 1, i + 1))}
                  disabled={index === diplomas.length - 1}
                  className="p-2 rounded-lg border border-toroto-border disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
