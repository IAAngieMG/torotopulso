import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fetchOverview, DEFAULT_RANGE, type Me, type Overview as OverviewData, type RangeOption, type SignalOption } from '../lib/apiClient.ts';
import { KpiGrid, WeeklyLineChart, EnergyDistributionCard, QuestionBanner, RangeSignalControls, chartTitleFor, AiInsightCard } from './PulseWidgets.tsx';
import TeamsTable from './TeamsTable.tsx';

const SIGNAL_QUESTION_KEY: Record<SignalOption, keyof OverviewData['questions'] | null> = {
  ALL: null,
  BD: 'BD',
  AL: 'AL',
  BT: 'BT',
  VIERNES: 'VIERNES',
};

export default function Overview({ me, onOpenTeam }: { me: Me; onOpenTeam: (team: string) => void }) {
  const isVisionGlobal = me.visionGlobal;
  const hasSecondaries = me.secondaryTeams.length > 0;
  const showToggle = hasSecondaries || isVisionGlobal;

  const [range, setRange] = useState<RangeOption>(DEFAULT_RANGE);
  const [signal, setSignal] = useState<SignalOption>('ALL');
  // Arranca siempre en "General" (todo el alcance) para quien tiene el toggle; quien no lo tiene
  // (un solo equipo) igual arranca vacío, que en su caso equivale a su único equipo.
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
  const kpiScope: 'mio' | 'general' | 'especifico' =
    activeTeam === '' ? 'general' : activeTeam === me.primaryTeam ? 'mio' : 'especifico';
  const scopeTitle = activeTeam || (hasSecondaries ? 'tus equipos' : 'tu equipo');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {isVisionGlobal ? 'Pulso general de la tropa' : `Pulso de ${scopeTitle}`}
          </h2>
          <p className="text-sm text-slate-500">
            {isVisionGlobal ? `Vista con visibilidad total · ${me.teams.length} equipos` : 'Vista con permisos de liderazgo'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showToggle && (
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTeam(me.primaryTeam || '')}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  kpiScope === 'mio' ? 'bg-white shadow-sm text-[#0b1c30]' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Mi equipo
              </button>
              <button
                onClick={() => setActiveTeam('')}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  kpiScope === 'general' ? 'bg-white shadow-sm text-[#0b1c30]' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                General
              </button>
            </div>
          )}
          {me.teams.length > 1 && (
            <select
              value={activeTeam}
              onChange={e => setActiveTeam(e.target.value)}
              className="rounded-lg border border-toroto-border px-3 py-2 text-sm bg-white"
            >
              <option value="">{isVisionGlobal ? 'Toda la tropa' : 'Todos mis equipos'}</option>
              {!isVisionGlobal && me.primaryTeam ? (
                <>
                  <optgroup label="Tu equipo">
                    <option value={me.primaryTeam}>{me.primaryTeam}</option>
                  </optgroup>
                  {hasSecondaries && (
                    <optgroup label="Equipos secundarios">
                      {me.secondaryTeams.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              ) : (
                me.teams.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))
              )}
            </select>
          )}
        </div>
      </div>

      <RangeSignalControls range={range} onRange={setRange} signal={signal} onSignal={setSignal} />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-slate-500">Cargando…</p>}

      {data && (
        <>
          {questionKey && <QuestionBanner text={data.questions[questionKey]} />}
          <KpiGrid kpis={data.kpis} />
          <div className="grid lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 space-y-4">
              <WeeklyLineChart points={data.weeklySeries} title={chartTitleFor(range)} />
              <EnergyDistributionCard dist={data.energyDistribution} />
            </div>
            <AiInsightCard insight={data.insight} />
          </div>

          {isVisionGlobal ? (
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
          ) : (
            <TeamsTable onOpenTeam={onOpenTeam} primaryTeam={me.primaryTeam} />
          )}
        </>
      )}
    </div>
  );
}
