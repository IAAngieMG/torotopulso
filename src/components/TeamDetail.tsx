import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { fetchTeamDetail, type Me, type RangeOption, type TeamDetail as TeamDetailData } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';
import { KpiGrid, WeeklyLineChart, EnergyDistributionCard, RangeSignalControls } from './PulseWidgets.tsx';
import FeedbackWidget from './FeedbackWidget.tsx';

interface TeamDetailProps {
  me: Me;
  team: string;
  onBack: () => void;
  onOpenPerson: (email: string) => void;
}

export default function TeamDetail({ me, team, onBack, onOpenPerson }: TeamDetailProps) {
  const [range, setRange] = useState<RangeOption>('week');
  const [data, setData] = useState<TeamDetailData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchTeamDetail(team, range)
      .then(d => !cancelled && setData(d))
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [team, range]);

  return (
    <div>
      <TopBar name={me.name} />
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver a vista general
        </button>

        <div>
          <h2 className="font-display text-lg font-semibold">Detalle de equipo · {team}</h2>
          {data && <p className="text-sm text-slate-500">Líder: {data.leader}</p>}
        </div>

        <RangeSignalControls range={range} onRange={setRange} signal="ALL" onSignal={() => {}} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="text-sm text-slate-500">Cargando…</p>}

        {data && (
          <>
            <KpiGrid kpis={data.kpis} />
            <div className="grid md:grid-cols-2 gap-4">
              <WeeklyLineChart points={data.weeklySeries} />
              <EnergyDistributionCard dist={data.energyDistribution} />
            </div>

            <div className="rounded-xl border border-toroto-border bg-white p-4">
              <p className="font-display font-semibold text-sm mb-3">Miembros de {team} · Pulso individual</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.members.map(member => (
                  <button
                    key={member.email}
                    onClick={() => onOpenPerson(member.email)}
                    className="text-left rounded-lg border border-toroto-border p-3 hover:border-toroto-primary transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#0b1c30]">
                        {member.fullName} {member.isLeader && <span className="text-xs text-toroto-primary">(líder)</span>}
                      </p>
                      <ChevronRight size={14} className="text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Pulso semanal:{' '}
                      {member.weeklyKpis.bdAverage != null || member.weeklyKpis.btAverage != null
                        ? `${(((member.weeklyKpis.bdAverage ?? 0) + (member.weeklyKpis.btAverage ?? 0)) / (member.weeklyKpis.bdAverage != null && member.weeklyKpis.btAverage != null ? 2 : 1)).toFixed(1)} / 5`
                        : 'sin datos'}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <FeedbackWidget view={`Detalle de equipo · ${team}`} />
      </div>
    </div>
  );
}
