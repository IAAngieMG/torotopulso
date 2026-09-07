import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Minus, ChevronRight } from 'lucide-react';
import { fetchTeamsSummary, type RangeOption, type SignalOption, type TeamSummary } from '../lib/apiClient.ts';
import { RangeSignalControls } from './PulseWidgets.tsx';

const TREND_ICON = { up: ArrowUp, down: ArrowDown, flat: Minus } as const;
const TREND_COLOR = { up: 'text-emerald-600', down: 'text-red-500', flat: 'text-slate-400' } as const;

export default function TeamsTable({ onOpenTeam }: { onOpenTeam: (team: string) => void }) {
  const [range, setRange] = useState<RangeOption>('week');
  const [signal, setSignal] = useState<SignalOption>('ALL');
  const [teams, setTeams] = useState<TeamSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchTeamsSummary(range, signal)
      .then(d => !cancelled && setTeams(d.teams))
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [range, signal]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Pulso por equipos</h2>
        <p className="text-sm text-slate-500">Una mirada rápida a cómo está viviendo el rango cada equipo.</p>
      </div>
      <RangeSignalControls range={range} onRange={setRange} signal={signal} onSignal={setSignal} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!teams && !error && <p className="text-sm text-slate-500">Cargando…</p>}
      {teams && (
        <div className="rounded-xl border border-toroto-border bg-white overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-toroto-border">
                <th className="px-4 py-3 font-medium">Equipo</th>
                <th className="px-4 py-3 font-medium">Inicio BD</th>
                <th className="px-4 py-3 font-medium">Cierre BT</th>
                <th className="px-4 py-3 font-medium">Participación</th>
                <th className="px-4 py-3 font-medium">A tiempo</th>
                <th className="px-4 py-3 font-medium">Tendencia</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(t => {
                const TrendIcon = TREND_ICON[t.trend];
                return (
                  <tr key={t.team} className="border-b border-toroto-border last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0b1c30]">{t.team}</p>
                      <p className="text-xs text-slate-400">{t.leader}</p>
                    </td>
                    <td className="px-4 py-3">{t.kpis.bdAverage != null ? `${t.kpis.bdAverage.toFixed(1)}/5` : '—'}</td>
                    <td className="px-4 py-3">{t.kpis.btAverage != null ? `${t.kpis.btAverage.toFixed(1)}/5` : '—'}</td>
                    <td className="px-4 py-3">{t.kpis.participationPct != null ? `${t.kpis.participationPct}%` : '—'}</td>
                    <td className="px-4 py-3">{t.kpis.onTimePct != null ? `${t.kpis.onTimePct}%` : '—'}</td>
                    <td className="px-4 py-3">
                      <TrendIcon size={14} className={TREND_COLOR[t.trend]} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onOpenTeam(t.team)}
                        className="inline-flex items-center gap-1 text-toroto-primary text-sm font-medium hover:underline"
                      >
                        Ver equipo <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
