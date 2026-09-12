import { useEffect, useState } from 'react';
import { ArrowLeft, Sparkles, Check, X, Send, Bell, ChevronLeft, ChevronRight, Award, Hash, Eye, SlidersHorizontal } from 'lucide-react';
import {
  approveDiploma,
  dismissLaunchRequest,
  fetchLaunchRequest,
  fetchPendingRecognitions,
  generateDiploma,
  publishRecognitions,
  rejectNomination,
  type LaunchRequest,
  type Me,
  type Nomination,
} from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';
import DiplomaCard from './DiplomaCard.tsx';

const PLACEHOLDER_ROLE = 'Rol / puesto en la tropa';
const PLACEHOLDER_MENTION =
  'Aquí se insertará automáticamente el mensaje de reconocimiento redactado por la tropa vía Slack al cierre de votación.';

const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  generado: 'Generado',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
  rechazado: 'Descartado',
};

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'aprobado' || status === 'publicado'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : status === 'generado'
        ? 'bg-blue-50 text-blue-700 border border-blue-200'
        : 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${style}`}>
      {status === 'aprobado' && <Check size={10} />} {STATUS_LABEL[status] || status}
    </span>
  );
}

function LaunchAlert({ request, onDismissed }: { request: LaunchRequest; onDismissed: () => void }) {
  const [busy, setBusy] = useState(false);
  const dismiss = async () => {
    setBusy(true);
    try {
      await dismissLaunchRequest();
      onDismissed();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-3">
        <Bell size={16} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-900">Solicitud de Santiago</p>
          <p className="text-sm text-amber-800">
            "{request.label}" · Programado para {new Date(request.scheduledFor).toLocaleString('es-MX')}
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-white border border-amber-200 rounded-full px-2 py-0.5">
            Esperando validación y generación con IA
          </span>
        </div>
      </div>
      <button
        onClick={dismiss}
        disabled={busy}
        className="text-xs font-medium rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-amber-700 disabled:opacity-50 shrink-0"
      >
        Marcar como atendida
      </button>
    </div>
  );
}

/** Una fila de la bandeja: resume la nominación y permite traerla al panel de vista previa. */
function InboxRow({
  nomination,
  isSelected,
  onSelect,
  onGenerate,
  busy,
}: {
  nomination: Nomination;
  isSelected: boolean;
  onSelect: () => void;
  onGenerate: () => void;
  busy: boolean;
}) {
  const status = nomination.record?.status || 'pendiente';
  const nomineeName = nomination.record?.nomineeName || 'Nombre';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      className={`w-full text-left rounded-xl border p-3 space-y-2 transition-colors cursor-pointer ${
        isSelected ? 'border-toroto-primary bg-toroto-primary-light/40' : 'border-toroto-border bg-white hover:border-toroto-primary/40'
      }`}
    >
      {isSelected && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
          <Hash size={10} /> reconocimientos
        </span>
      )}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#0b1c30] truncate">
          {nomination.nominatorName || nomination.nominatorEmail} <span className="text-slate-400">→</span> {nomineeName}
        </p>
        {!isSelected && <StatusBadge status={status} />}
      </div>
      <p className="text-xs text-slate-500 line-clamp-3">{nomination.rawText}</p>
      <div className="flex items-center gap-2 pt-1">
        {isSelected ? (
          status === 'pendiente' ? (
            <button
              onClick={e => {
                e.stopPropagation();
                onGenerate();
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-toroto-primary text-white px-3 py-1.5 disabled:opacity-50"
            >
              <Sparkles size={13} /> {busy ? 'Generando…' : 'Generar diploma con IA'}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-toroto-primary">
              <Eye size={13} /> Viendo en panel
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <SlidersHorizontal size={13} /> Seleccionar para generar con IA
          </span>
        )}
      </div>
    </div>
  );
}

export default function RecognitionsAdmin({
  me,
  onSetViewAs,
  onBack,
}: {
  me: Me;
  onSetViewAs?: (email: string) => void;
  onBack: () => void;
}) {
  const [month, setMonth] = useState('');
  const [pending, setPending] = useState<Nomination[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [publishMsg, setPublishMsg] = useState('');
  const [launchRequest, setLaunchRequest] = useState<LaunchRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<'formal' | 'calido'>('calido');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRole, setNomineeRole] = useState('');
  const [diplomaText, setDiplomaText] = useState('');

  const load = () => {
    fetchPendingRecognitions()
      .then(d => {
        setMonth(d.month);
        setPending(d.pending);
        setSelectedId(prev => (prev && d.pending.some(n => n.id === prev) ? prev : d.pending[0]?.id ?? null));
      })
      .catch(e => setError(e.message));
    fetchLaunchRequest()
      .then(d => setLaunchRequest(d.request))
      .catch(() => {});
  };

  useEffect(load, []);

  const selected = pending?.find(n => n.id === selectedId) || null;
  const selectedIndex = pending && selected ? pending.indexOf(selected) : -1;

  useEffect(() => {
    setActionError('');
    setTone(selected?.record?.tone || 'calido');
    setNomineeName(selected?.record?.nomineeName || '');
    setNomineeRole(selected?.record?.nomineeRole || '');
    setDiplomaText(selected?.record?.diplomaText || '');
  }, [selectedId]);

  const status = selected?.record?.status || 'pendiente';
  const approvedCount = pending?.filter(n => n.record?.status === 'aprobado').length || 0;

  const generate = async () => {
    if (!selected) return;
    setBusy(true);
    setActionError('');
    try {
      const { record } = await generateDiploma(selected.id, tone);
      setNomineeName(record.nomineeName);
      setNomineeRole(record.nomineeRole);
      setDiplomaText(record.diplomaText);
      load();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!selected) return;
    setBusy(true);
    setActionError('');
    try {
      await approveDiploma(selected.id, nomineeName, nomineeRole, diplomaText);
      load();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await rejectNomination(selected.id);
      load();
    } finally {
      setBusy(false);
    }
  };

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
      <TopBar me={me} onSetViewAs={onSetViewAs} />
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver
        </button>
        <div>
          <h2 className="font-display text-lg font-semibold">Reconocimientos del mes · {month}</h2>
          <p className="text-sm text-slate-500">Nominaciones recibidas vía Slack, listas para generar y aprobar su diploma.</p>
        </div>

        {launchRequest && launchRequest.status === 'pendiente' && (
          <LaunchAlert request={launchRequest} onDismissed={() => setLaunchRequest(null)} />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!pending && !error && <p className="text-sm text-slate-500">Cargando…</p>}
        {pending?.length === 0 && <p className="text-sm text-slate-500">No hay nominaciones pendientes este mes.</p>}

        {pending && pending.length > 0 && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
            <div className="rounded-xl border border-toroto-border bg-white p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-toroto-primary" />
                  <p className="font-display font-semibold text-sm">Plantilla y vista previa del diploma</p>
                </div>
                {pending.length > 1 && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <button
                      onClick={() => setSelectedId(pending[Math.max(0, selectedIndex - 1)].id)}
                      disabled={selectedIndex <= 0}
                      className="p-1.5 rounded-lg border border-toroto-border disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    {selectedIndex + 1} de {pending.length} diplomas
                    <button
                      onClick={() => setSelectedId(pending[Math.min(pending.length - 1, selectedIndex + 1)].id)}
                      disabled={selectedIndex >= pending.length - 1}
                      className="p-1.5 rounded-lg border border-toroto-border disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </div>

              {selected && (
                <>
                  <DiplomaCard
                    nomineeName={nomineeName}
                    nomineeRole={nomineeRole || PLACEHOLDER_ROLE}
                    mention={diplomaText || PLACEHOLDER_MENTION}
                    month={selected.month || month}
                  />

                  <div className="grid md:grid-cols-2 gap-3 pt-2 border-t border-toroto-border">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">Persona reconocida</label>
                      <input
                        value={nomineeName}
                        onChange={e => setNomineeName(e.target.value)}
                        className="w-full rounded-lg border border-toroto-border px-3 py-2 text-sm"
                        placeholder="Nombre y apellido"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">Rol / equipo (opcional)</label>
                      <input
                        value={nomineeRole}
                        onChange={e => setNomineeRole(e.target.value)}
                        className="w-full rounded-lg border border-toroto-border px-3 py-2 text-sm"
                        placeholder="Ej. Líder, Gerencia de Restauración Territorial"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">Mención de honor</label>
                      <textarea
                        value={diplomaText}
                        onChange={e => setDiplomaText(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-toroto-border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  {actionError && <p className="text-xs text-red-600">{actionError}</p>}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      onClick={generate}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-toroto-primary text-toroto-primary px-3 py-1.5 disabled:opacity-50"
                    >
                      <Sparkles size={13} /> {status === 'pendiente' ? 'Generar texto con IA' : 'Regenerar texto con IA'}
                    </button>
                    <select
                      value={tone}
                      onChange={e => setTone(e.target.value as 'formal' | 'calido')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-toroto-border px-2.5 py-1.5"
                      disabled={busy}
                      title="Ajustar tono"
                    >
                      <option value="calido">Ajustar tono: cálido</option>
                      <option value="formal">Ajustar tono: formal</option>
                    </select>
                    <button
                      onClick={approve}
                      disabled={busy || !nomineeName}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white px-3 py-1.5 disabled:opacity-50"
                    >
                      <Check size={13} /> {status === 'aprobado' ? 'Guardar cambios' : 'Aprobar diploma'}
                    </button>
                    <button
                      onClick={reject}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border border-toroto-border px-3 py-1.5 text-slate-500 disabled:opacity-50"
                    >
                      <X size={13} /> Descartar
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-toroto-border bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Hash size={16} className="text-purple-600" />
                  <p className="font-display font-semibold text-sm">Bandeja de Slack</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{pending.length} pendientes</span>
              </div>
              <div className="space-y-3">
                {pending.map(n => (
                  <InboxRow
                    key={n.id}
                    nomination={n}
                    isSelected={n.id === selectedId}
                    onSelect={() => setSelectedId(n.id)}
                    onGenerate={() => {
                      setSelectedId(n.id);
                      generate();
                    }}
                    busy={busy && n.id === selectedId}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {pending && pending.length > 0 && (
          <div className="rounded-xl border border-toroto-border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {approvedCount} de {pending.length} diplomas aprobados. Al hacer clic en "Listo", los diplomas aprobados se publicarán
              automáticamente en el dashboard de Karla, Patricia y Santiago para {month}.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                disabled
                title="Los cambios ya se guardan al generar o aprobar cada diploma — el borrador independiente llega cuando conectemos el Sheet de nominaciones."
                className="text-sm font-medium rounded-lg border border-toroto-border px-4 py-2 opacity-40 cursor-not-allowed"
              >
                Guardar borrador
              </button>
              <button
                onClick={publish}
                disabled={approvedCount === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-toroto-primary text-white text-sm font-semibold px-4 py-2 disabled:opacity-50"
              >
                <Send size={14} /> Listo: publicar diplomas del mes
              </button>
            </div>
          </div>
        )}
        {publishMsg && <p className="text-sm text-emerald-600">{publishMsg}</p>}
      </div>
    </div>
  );
}
