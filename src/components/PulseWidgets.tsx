import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { DailyPoint, EnergyDistribution, Kpis } from '../lib/apiClient.ts';

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
      <KpiCard label="Inicio del día (BD)" value={kpis.bdAverage != null ? kpis.bdAverage.toFixed(1) : '—'} suffix="/ 5" />
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

export function WeeklyLineChart({ points }: { points: DailyPoint[] }) {
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4">
      <p className="font-display font-semibold text-sm mb-3">Evolución de la semana</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <YAxis domain={[1, 5]} tick={{ fontSize: 12 }} stroke="#94a3b8" />
          <Tooltip />
          <Line type="monotone" dataKey="bd" name="Inicio (BD)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          <Line type="monotone" dataKey="bt" name="Cierre (BT)" stroke="#0055b8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
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
  const ranges: Array<[string, string]> = [
    ['realtime', 'En tiempo real'],
    ['week', 'Esta semana'],
    ['month', 'Este mes'],
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
      <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {ranges.map(([value, label]) => (
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
