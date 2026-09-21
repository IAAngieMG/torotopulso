import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarClock, Send, History, Download, Bot } from 'lucide-react';
import {
  fetchLaunchRequest,
  fetchPublishedRecognitions,
  scheduleLaunch,
  type LaunchRequest,
  type Me,
  type RecognitionRecord,
} from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';
import DiplomaCard from './DiplomaCard.tsx';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Últimos `n` meses (incluyendo el actual) en el mismo formato "Mes AAAA" que usa el backend. */
function recentMonths(n = 6): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${MESES[d.getMonth()]} ${d.getFullYear()}`);
  }
  return months;
}

function LaunchScheduler() {
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [existing, setExisting] = useState<LaunchRequest | null>(null);

  useEffect(() => {
    fetchLaunchRequest()
      .then(d => setExisting(d.request))
      .catch(() => {});
  }, [status]);

  const submit = async () => {
    if (!date) return;
    setStatus('sending');
    try {
      const { request } = await scheduleLaunch(new Date(date).toISOString(), label);
      setExisting(request);
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
        Programa cuándo se lanza el próximo ciclo de reconocimientos. Angie, Karla y Samantha recibirán la solicitud para generar y aprobar los diplomas.
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
      {existing && existing.status === 'pendiente' && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-toroto-border rounded-lg px-3 py-2">
          Próximo disparo programado: <strong>{new Date(existing.scheduledFor).toLocaleString('es-MX')}</strong> · "{existing.label}"
        </p>
      )}
      {status === 'sent' && <p className="text-xs text-emerald-600">Listo — Angie, Karla y Samantha ya pueden verla.</p>}
      {status === 'error' && <p className="text-xs text-red-600">No se pudo enviar la solicitud.</p>}
    </div>
  );
}

function BotPreviewCard({ month }: { month: string }) {
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bot size={16} className="text-toroto-primary" />
          <p className="font-display font-semibold text-sm">Reconocimientos tropa bot</p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
          Vista previa del bot
        </span>
      </div>
      <p className="text-xs text-slate-500">Mensaje que recibirá la tropa en Slack.</p>
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
        <p className="text-sm font-semibold text-[#0b1c30]">Es momento de reconocer a nuestro equipo.</p>
        <p className="text-sm text-slate-600">
          ¡Queremos celebrar a quienes han hecho la diferencia en {month}! ¿A quién te gustaría reconocer y por qué en breves palabras?
          Envía tu nominación directa en Slack.
        </p>
      </div>
      <p className="text-[11px] text-slate-400">Canal: #reconocimientos · Respuesta abierta a toda la tropa</p>
    </div>
  );
}

export default function RecognitionsGallery({
  me,
  onSetViewAs,
  onBack,
}: {
  me: Me;
  onSetViewAs?: (email: string) => void;
  onBack: () => void;
}) {
  const [month, setMonth] = useState('');
  const [diplomas, setDiplomas] = useState<RecognitionRecord[] | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  const loadMonth = (targetMonth?: string) => {
    setDiplomas(null);
    setIndex(0);
    fetchPublishedRecognitions(targetMonth)
      .then(d => {
        setMonth(d.month);
        setDiplomas(d.diplomas);
      })
      .catch(e => setError(e.message));
  };

  useEffect(() => {
    loadMonth();
  }, []);

  const current = diplomas?.[index];
  const isSantiago = me.email === 'santiago@toroto.mx';
  const isPatricia = me.email === 'patricia@toroto.mx';
  const isSamantha = me.email === 'samantha@toroto.mx';
  const isEnhanced = isSantiago || isPatricia || isSamantha;

  return (
    <div>
      <TopBar me={me} onSetViewAs={onSetViewAs} />
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-diploma-area, .print-diploma-area * { visibility: visible; }
          .print-diploma-area { position: absolute; inset: 0; }
        }
      `}</style>
      <div className={`p-4 md:p-8 space-y-6 ${isEnhanced ? 'max-w-4xl' : 'max-w-2xl'}`}>
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 print:hidden">
          <ArrowLeft size={14} /> Volver
        </button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {isEnhanced && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 mb-1.5">
                Ciclo de reconocimientos · Edición {month}
              </span>
            )}
            <h2 className="font-display text-lg font-semibold">
              {isEnhanced ? 'Reconocimientos del Mes · Programa y Celebra el Talento' : `Reconocimientos del mes · ${month}`}
            </h2>
            <p className="text-sm text-slate-500">Diplomas publicados para toda la tropa.</p>
          </div>
          <div className="flex items-center gap-2">
            {isEnhanced && (
              <button
                onClick={() => setShowHistory(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-toroto-border px-3 py-2 bg-white hover:bg-slate-50"
              >
                <History size={13} /> Ver historial
              </button>
            )}
          </div>
        </div>

        {showHistory && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-toroto-border bg-white p-3">
            <p className="text-xs text-slate-500">Ver diplomas publicados de:</p>
            {recentMonths().map(m => (
              <button
                key={m}
                onClick={() => loadMonth(m)}
                className={`text-xs font-medium rounded-full px-3 py-1 border ${
                  m === month ? 'bg-toroto-primary text-white border-toroto-primary' : 'border-toroto-border text-slate-600 hover:bg-slate-50'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {isEnhanced &&
          (isSantiago ? (
            <div className="grid md:grid-cols-2 gap-4">
              <LaunchScheduler />
              <BotPreviewCard month={month} />
            </div>
          ) : (
            <BotPreviewCard month={month} />
          ))}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!diplomas && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {diplomas?.length === 0 && (
          <div className="rounded-xl border border-toroto-border bg-white p-8 text-center text-sm text-slate-500">
            Aún no hay diplomas publicados de {month}.
          </div>
        )}

        {current && (
          <div className="rounded-xl border border-toroto-border bg-white p-6">
            {isEnhanced && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 print:hidden">
                <p className="font-display font-semibold text-sm">🏆 Diplomas del mes de {month}</p>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-toroto-border px-3 py-1.5 hover:bg-slate-50"
                >
                  <Download size={13} /> Descargar PDF (Vectorial)
                </button>
              </div>
            )}
            <div className="print-diploma-area">
              <DiplomaCard
                nomineeName={current.nomineeName}
                nomineeRole={current.nomineeRole}
                mention={current.diplomaText}
                month={current.month}
              />
              <p className="text-xs text-slate-400 mt-3 text-center">
                Nominado por {current.nominatorName || current.nominatorEmail}
              </p>
            </div>

            {diplomas && diplomas.length > 1 && (
              <div className="flex items-center justify-between mt-4 print:hidden">
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
