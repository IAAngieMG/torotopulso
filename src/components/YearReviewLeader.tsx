import { useEffect, useState } from 'react';
import { ChevronRight, Star, PartyPopper } from 'lucide-react';
import { fetchLeaderYearReview, type LeaderYearReview } from '../lib/apiClient.ts';
import { KpiCard, YearlyLineChart } from './PulseWidgets.tsx';

export default function YearReviewLeader({ onOpenPerson }: { onOpenPerson: (email: string) => void }) {
  const [data, setData] = useState<LeaderYearReview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchLeaderYearReview()
      .then(d => !cancelled && setData(d))
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Cargando…</p>;

  const { stats } = data;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-toroto-primary/25 bg-gradient-to-br from-toroto-primary-light to-white p-5">
        {data.preview && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5 mb-2">
            Vista previa · aún no es pública
          </span>
        )}
        <div className="flex items-center gap-2 mb-1">
          <PartyPopper size={18} className="text-toroto-primary" />
          <h2 className="font-display text-lg font-semibold">Tu {data.year} en Pulso, {data.name}</h2>
        </div>
        <p className="text-sm text-slate-500">
          {data.teams.length} equipo{data.teams.length === 1 ? '' : 's'} a tu cargo · {stats.totalResponses} respuestas en el año
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Promedio del año" value={stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'} suffix="/ 5" />
        <KpiCard label="Participación anual" value={stats.participationPct != null ? `${stats.participationPct}%` : '—'} />
        <KpiCard label="Mejor mes" value={stats.bestMonth || '—'} detail={stats.bestMonthAvg != null ? `${stats.bestMonthAvg.toFixed(1)}/5 promedio` : undefined} />
        <KpiCard label="Respuestas en el año" value={String(stats.totalResponses)} />
      </div>

      <YearlyLineChart points={stats.monthly} title="Tu año, mes a mes" />

      <div>
        <p className="font-display font-semibold text-sm mb-3">Áreas de oportunidad por equipo</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {data.teamOpportunities.map(opp => (
            <div
              key={opp.team}
              className={`rounded-xl border bg-white p-4 border-l-4 ${opp.status === 'good' ? 'border-l-emerald-400 border-toroto-border' : 'border-l-amber-400 border-toroto-border'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#0b1c30]">{opp.team}</p>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${
                    opp.status === 'good' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-amber-700 bg-amber-50 border border-amber-200'
                  }`}
                >
                  {opp.status === 'good' ? 'Va bien' : 'Oportunidad'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {opp.avgScore != null ? `${opp.avgScore.toFixed(1)}/5` : 'sin datos'}
                {opp.participationPct != null && ` · ${opp.participationPct}% participación`}
              </p>
              <p className="text-xs text-slate-600 mt-2">{opp.note}</p>
            </div>
          ))}
        </div>
      </div>

      {(data.personOpportunities.length > 0 || data.personHighlights.length > 0) && (
        <div>
          <p className="font-display font-semibold text-sm mb-3">Áreas de oportunidad individuales</p>
          <div className="rounded-xl border border-toroto-border bg-white overflow-hidden">
            {data.personOpportunities.map(p => (
              <button
                key={p.email}
                onClick={() => onOpenPerson(p.email)}
                className="w-full flex items-center gap-3 p-3 border-b border-toroto-border last:border-0 text-left hover:bg-slate-50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0b1c30]">{p.fullName}</p>
                  <p className="text-xs text-slate-400">{p.team}</p>
                  <p className="text-xs text-slate-600 mt-1">{p.note}</p>
                </div>
                <ChevronRight size={14} className="text-slate-400 shrink-0" />
              </button>
            ))}
            {data.personHighlights.map(p => (
              <button
                key={p.email}
                onClick={() => onOpenPerson(p.email)}
                className="w-full flex items-center gap-3 p-3 border-b border-toroto-border last:border-0 text-left hover:bg-slate-50"
              >
                <Star size={14} className="text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0b1c30]">{p.fullName}</p>
                  <p className="text-xs text-slate-400">{p.team}</p>
                  <p className="text-xs text-emerald-700 mt-1">Sin red flags en todo el año — reconocerlo.</p>
                </div>
                <ChevronRight size={14} className="text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
