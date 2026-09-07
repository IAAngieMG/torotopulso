import { useEffect, useState } from 'react';
import { ChevronRight, Sparkles } from 'lucide-react';
import { fetchOverview, type Me, type Overview as OverviewData, type RangeOption, type SignalOption } from '../lib/apiClient.ts';
import { KpiGrid, WeeklyLineChart, EnergyDistributionCard, QuestionBanner, RangeSignalControls, chartTitleFor } from './PulseWidgets.tsx';

const SIGNAL_QUESTION_KEY: Record<SignalOption, keyof OverviewData['questions'] | null> = {
  ALL: null,
  BD: 'BD',
  AL: 'AL',
  BT: 'BT',
  VIERNES: 'VIERNES',
};

function AiInsightCard({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={15} className="text-toroto-primary" />
        <p className="font-display font-semibold text-sm">Pulso IA</p>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
          Automático
        </span>
      </div>
      <p className="text-sm text-[#0b1c30]">{text}</p>
    </div>
  );
}

export default function Overview({ me, onOpenTeam }: { me: Me; onOpenTeam: (team: string) => void }) {
  const [range, setRange] = useState<RangeOption>('week');
  const [signal, setSignal] = useState<SignalOption>('ALL');
  const [activeTeam, setActiveTeam] = useState<string>('');
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchOverview(range, signal, activeTeam || undefined)
      .then(d => {
        if (!cancelled) setData(d);
      })
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [range, signal, activeTeam]);

  const questionKey = SIGNAL_QUESTION_KEY[signal];
  const isEjecutivo = me.role === 'ejecutivo';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {isEjecutivo ? 'Pulso general de la tropa' : `Pulso de ${activeTeam || 'tu equipo'}`}
          </h2>
          <p className="text-sm text-slate-500">
            {isEjecutivo ? `Vista con visibilidad total · ${me.teams.length} equipos` : 'Vista con permisos de liderazgo'}
          </p>
        </div>
        {me.teams.length > 1 && (
          <select
            value={activeTeam}
            onChange={e => setActiveTeam(e.target.value)}
            className="rounded-lg border border-toroto-border px-3 py-2 text-sm bg-white"
          >
            <option value="">{isEjecutivo ? 'Toda la tropa' : 'Todos mis equipos'}</option>
            {me.teams.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
      </div>

      <RangeSignalControls range={range} onRange={setRange} signal={signal} onSignal={setSignal} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Cargando…</p>}

      {data && (
        <>
          {questionKey && <QuestionBanner text={data.questions[questionKey]} />}
          <KpiGrid kpis={data.kpis} />
          <div className="grid md:grid-cols-2 gap-4">
            <WeeklyLineChart points={data.weeklySeries} title={chartTitleFor(range)} />
            <EnergyDistributionCard dist={data.energyDistribution} />
          </div>
          <AiInsightCard text={data.insight} />

          <div className="rounded-xl border border-toroto-border bg-white p-4">
            <p className="font-display font-semibold text-sm mb-3">Equipos {activeTeam ? 'relacionados' : 'en tu alcance'}</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.teams.map(team => (
                <button
                  key={team}
                  onClick={() => onOpenTeam(team)}
                  className="flex items-center justify-between rounded-lg border border-toroto-border px-3 py-2 text-sm text-left hover:border-toroto-primary hover:bg-toroto-primary-light transition-colors"
                >
                  <span className="truncate">{team}</span>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
