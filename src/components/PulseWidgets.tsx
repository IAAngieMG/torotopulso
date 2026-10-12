import { Fragment } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TreePalm, Sparkles, Lightbulb } from 'lucide-react';
import type { AutoInsight, DailyPoint, EnergyDistribution, Kpis } from '../lib/apiClient.ts';

/** Renders `**texto**` como negritas, sin traer una librería de markdown para esto. */
export function Bold({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-semibold text-[#0b1c30]">{part}</strong> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

/** Tarjeta de análisis automático ("Pulso IA"): usada tanto en la vista general/de equipo como en
 * el detalle de una persona (ahí reemplaza el listado de respuestas una por una). */
export function AiInsightCard({ insight, title = 'Pulso IA' }: { insight: AutoInsight; title?: string }) {
  if (!insight.headline) return null;
  return (
    <div className="rounded-xl border border-toroto-primary/25 bg-gradient-to-br from-toroto-primary-light to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-toroto-primary text-white flex items-center justify-center shrink-0">
          <Sparkles size={15} />
        </div>
        <p className="font-display font-semibold text-base text-[#0b1c30]">{title}</p>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-toroto-primary bg-white border border-toroto-primary/30 rounded-full px-2 py-0.5">
          Automático
        </span>
      </div>
      <p className="text-sm font-medium text-[#0b1c30] mb-3">{insight.headline}</p>
      {insight.bullets.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {insight.bullets.map((b, i) => (
            <li key={i} className="text-sm text-slate-600 flex gap-2">
              <span className="text-toroto-primary mt-0.5">•</span>
              <span><Bold text={b} /></span>
            </li>
          ))}
        </ul>
      )}
      {insight.recommendation && (
        <div className="flex items-start gap-2 rounded-lg bg-white border border-toroto-border p-3 mt-2">
          <Lightbulb size={15} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Sugerencia de acción</p>
            <p className="text-sm text-[#0b1c30]">{insight.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Leyenda de vacaciones/ausencia junto al nombre de una persona, para que su líder lo sepa a simple vista. */
export function VacationBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
      <TreePalm size={10} /> {label}
    </span>
  );
}

export function KpiCard({ label, value, suffix, detail }: { label: string; value: string; suffix?: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-[#0b1c30]">
        {value}
        {suffix && <span className="text-sm font-medium text-slate-400"> {suffix}</span>}
      </p>
      {detail && <p className="text-xs text-slate-400 mt-1">{detail}</p>}
    </div>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        label={kpis.bdOnTimePct != null ? 'Inicio del día · % a tiempo' : 'Inicio del día (BD)'}
        value={kpis.bdOnTimePct != null ? `${kpis.bdOnTimePct}%` : kpis.bdAverage != null ? kpis.bdAverage.toFixed(1) : '—'}
        suffix={kpis.bdOnTimePct == null && kpis.bdAverage != null ? '/ 5' : undefined}
        detail={kpis.bdOnTimePct != null ? (kpis.bdOnTimeDetail ?? undefined) : undefined}
      />
      <KpiCard label="Cierre del día (BT)" value={kpis.btAverage != null ? kpis.btAverage.toFixed(1) : '—'} suffix="/ 5" />
      <KpiCard
        label="Participación"
        value={kpis.participationPct != null ? `${kpis.participationPct}%` : '—'}
        detail={kpis.participationDetail}
      />
      <KpiCard label="Respuestas a tiempo" value={kpis.onTimePct != null ? `${kpis.onTimePct}%` : '—'} />
    </div>
  );
}

const CHART_TITLES: Record<string, string> = {
  realtime: 'Evolución de la semana',
  week: 'Evolución de la semana',
  lastWeek: 'Evolución de la semana pasada',
  month: 'Evolución por semana (este mes)',
  quarter: 'Evolución por semana (este trimestre)',
  semester: 'Evolución por semana (este semestre)',
  year: 'Evolución por semana (este año)',
};

export function chartTitleFor(range: string): string {
  return CHART_TITLES[range] || 'Evolución';
}

export function WeeklyLineChart({ points, title = 'Evolución' }: { points: DailyPoint[]; title?: string }) {
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4">
      <p className="font-display font-semibold text-sm mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis yAxisId="left" domain={[1, 5]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 12 }}
            stroke="#94a3b8"
          />
          <Tooltip formatter={(value: any, name) => (name === 'Inicio del día · % a tiempo' ? [`${value}%`, name] : [value, name])} />
          {/* "Inicio del día" ya no trae calificación 1-5 (es un check-in por botones), así que su
              línea mide a qué hora contestan: % que registró su entrada a tiempo (9:00-9:30 am). */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="bdOnTimePct"
            name="Inicio del día · % a tiempo"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
          <Line yAxisId="left" type="monotone" dataKey="bt" name="Cierre (BT)" stroke="#0055b8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EnergyDistributionCard({ dist }: { dist: EnergyDistribution | null }) {
  if (!dist) return null;
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4">
      <p className="font-display font-semibold text-sm mb-3">Distribución de energía (encuesta de alimentos)</p>
      <div className="flex h-3 rounded-full overflow-hidden mb-3">
        <div className="bg-emerald-500" style={{ width: `${dist.altaEnergiaPct}%` }} />
        <div className="bg-amber-400" style={{ width: `${dist.enfoquePct}%` }} />
        <div className="bg-red-400" style={{ width: `${dist.pausaPct}%` }} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Alta energía: {dist.altaEnergiaPct}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Enfoque: {dist.enfoquePct}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Pausa requerida: {dist.pausaPct}%</span>
      </div>
    </div>
  );
}

export function QuestionBanner({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-toroto-primary/20 bg-toroto-primary-light p-4 text-sm text-[#0b1c30] whitespace-pre-line">
      {text}
    </div>
  );
}

export function RangeSignalControls({
  range,
  onRange,
  signal,
  onSignal,
}: {
  range: string;
  onRange: (v: any) => void;
  signal: string;
  onSignal: (v: any) => void;
}) {
  const quickRanges: Array<[string, string]> = [
    ['realtime', 'En tiempo real'],
    ['week', 'Esta semana'],
  ];
  const moreRanges: Array<[string, string]> = [
    ['lastWeek', 'Semana pasada'],
    ['month', 'Este mes'],
    ['quarter', 'Este trimestre'],
    ['semester', 'Este semestre'],
    ['year', 'Este año'],
  ];
  const signals: Array<[string, string]> = [
    ['ALL', 'Todas las señales'],
    ['BD', 'BD · Inicio'],
    ['AL', 'AL · Alimentos'],
    ['BT', 'BT · Cierre'],
    ['VIERNES', 'Encuesta Viernes'],
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1 w-fit">
          {quickRanges.map(([value, label]) => (
            <button
              key={value}
              onClick={() => onRange(value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                range === value ? 'bg-white shadow-sm text-[#0b1c30]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={moreRanges.some(([v]) => v === range) ? range : ''}
          onChange={e => onRange(e.target.value)}
          className={`text-xs font-medium rounded-lg border px-2.5 py-1.5 bg-white ${
            moreRanges.some(([v]) => v === range) ? 'border-toroto-primary text-toroto-primary' : 'border-toroto-border text-slate-500'
          }`}
        >
          <option value="" disabled>
            Otro rango…
          </option>
          {moreRanges.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-1">
        {signals.map(([value, label]) => (
          <button
            key={value}
            onClick={() => onSignal(value)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              signal === value
                ? 'bg-toroto-primary text-white border-toroto-primary'
                : 'bg-white text-slate-600 border-toroto-border hover:border-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
