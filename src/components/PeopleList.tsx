import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fetchPeople, type PersonSummary, type RangeOption } from '../lib/apiClient.ts';
import { RangeSignalControls } from './PulseWidgets.tsx';

export default function PeopleList({ onlyLeaders, onOpenPerson }: { onlyLeaders: boolean; onOpenPerson: (email: string) => void }) {
  const [range, setRange] = useState<RangeOption>('week');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<PersonSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchPeople(range, onlyLeaders)
      .then(d => !cancelled && setPeople(d.people))
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [range, onlyLeaders]);

  const filtered = people?.filter(p => p.fullName.toLowerCase().includes(query.toLowerCase()) || p.team.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">{onlyLeaders ? 'Líderes' : 'Personas'}</h2>
        <p className="text-sm text-slate-500">
          {onlyLeaders ? 'Cada líder de equipo dentro de tu alcance.' : 'Toda la tropa dentro de tu alcance, persona por persona.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <RangeSignalControls range={range} onRange={setRange} signal="ALL" onSignal={() => {}} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre o equipo…"
          className="rounded-lg border border-toroto-border px-3 py-2 text-sm w-full sm:w-64"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!people && !error && <p className="text-sm text-slate-500">Cargando…</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered?.map(p => (
          <button
            key={p.email}
            onClick={() => onOpenPerson(p.email)}
            className="text-left rounded-lg border border-toroto-border bg-white p-3 hover:border-toroto-primary transition-colors"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[#0b1c30]">
                {p.fullName} {p.isLeader && <span className="text-xs text-toroto-primary">(líder)</span>}
              </p>
              <ChevronRight size={14} className="text-slate-400" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{p.team}</p>
            <p className="text-xs text-slate-500 mt-1">
              BD {p.kpis.bdAverage != null ? `${p.kpis.bdAverage.toFixed(1)}/5` : '—'} · BT{' '}
              {p.kpis.btAverage != null ? `${p.kpis.btAverage.toFixed(1)}/5` : '—'}
            </p>
          </button>
        ))}
      </div>
      {filtered?.length === 0 && <p className="text-sm text-slate-500">Sin resultados.</p>}
    </div>
  );
}
