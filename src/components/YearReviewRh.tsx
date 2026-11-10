import { useEffect, useState } from 'react';
import { Grape, Trophy, AlertTriangle } from 'lucide-react';
import { fetchRhYearReview, type RhYearReview } from '../lib/apiClient.ts';
import { KpiCard, YearlyLineChart } from './PulseWidgets.tsx';

export default function YearReviewRh() {
  const [data, setData] = useState<RhYearReview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchRhYearReview()
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
      <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 via-amber-50 to-white p-5">
        {data.preview && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700 bg-white border border-purple-200 rounded-full px-2 py-0.5 mb-2">
            Vista previa · aún no es pública
          </span>
        )}
        <div className="flex items-center gap-2 mb-1">
          <Grape size={18} className="text-purple-600" />
          <h2 className="font-display text-lg font-semibold">{data.year} visto desde RH</h2>
        </div>
        <p className="text-sm text-slate-500">Toda la tropa · {stats.totalResponses} respuestas en el año</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Promedio general" value={stats.avgScore != null ? stats.avgScore.toFixed(1) : '—'} suffix="/ 5" />
        <KpiCard label="Participación general" value={stats.participationPct != null ? `${stats.participationPct}%` : '—'} />
        <KpiCard label="Equipos van bien" value={String(data.teamsGood.length)} />
        <KpiCard label="Equipos con oportunidad" value={String(data.teamsNeedReview.length)} />
      </div>

      <YearlyLineChart points={stats.monthly} title="La tropa, mes a mes" />

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="flex items-center gap-1.5 font-display font-semibold text-sm mb-3 text-emerald-700">
            <Trophy size={14} /> Equipos que van bien
          </p>
          <div className="space-y-2">
            {data.teamsGood.map(t => (
              <div key={t.team} className="flex items-center justify-between gap-2 rounded-lg border border-toroto-border bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0b1c30] truncate">{t.team}</p>
                  <p className="text-xs text-slate-400 truncate">{t.leader}</p>
                </div>
                <p className="text-sm font-display font-semibold text-emerald-600 shrink-0">{t.avgScore?.toFixed(1) ?? '—'}</p>
              </div>
            ))}
            {data.teamsGood.length === 0 && <p className="text-xs text-slate-400">Sin equipos en esta categoría todavía.</p>}
          </div>
        </div>
        <div>
          <p className="flex items-center gap-1.5 font-display font-semibold text-sm mb-3 text-amber-700">
            <AlertTriangle size={14} /> Equipos que necesitan revisión
          </p>
          <div className="space-y-2">
            {data.teamsNeedReview.map(t => (
              <div key={t.team} className="flex items-center justify-between gap-2 rounded-lg border border-toroto-border bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0b1c30] truncate">{t.team}</p>
                  <p className="text-xs text-slate-400 truncate">{t.leader}</p>
                </div>
                <p className="text-sm font-display font-semibold text-amber-600 shrink-0">{t.avgScore?.toFixed(1) ?? '—'}</p>
              </div>
            ))}
            {data.teamsNeedReview.length === 0 && <p className="text-xs text-slate-400">Ningún equipo necesita revisión — gran año.</p>}
          </div>
        </div>
      </div>

      {data.leaderOpportunities.length > 0 && (
        <div>
          <p className="font-display font-semibold text-sm mb-3">Áreas de oportunidad de los líderes</p>
          <div className="rounded-xl border border-toroto-border bg-white overflow-hidden">
            {data.leaderOpportunities.map(l => (
              <div key={l.leaderEmail} className="p-3 border-b border-toroto-border last:border-0">
                <p className="text-sm font-medium text-[#0b1c30]">{l.leader}</p>
                <p className="text-xs text-slate-400">{l.team}</p>
                <p className="text-xs text-slate-600 mt-1">{l.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5 text-center">
        <p className="font-display font-semibold text-sm">🍇 Las 12 uvas de Pulso Toroto</p>
        <p className="text-xs text-slate-500 mt-1">Un deseo por cada mes del próximo año, basado en lo que vimos en {data.year}.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-4">
          {data.wishes.map(w => (
            <div key={w.month} className="rounded-lg bg-white border border-purple-100 p-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">{w.month}</p>
              <p className="text-xs text-slate-600 mt-1">{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
