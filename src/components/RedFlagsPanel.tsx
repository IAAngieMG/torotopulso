import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ChevronRight, Palmtree } from 'lucide-react';
import { fetchRedFlags, type PersonRedFlags, type VacationStatus } from '../lib/apiClient.ts';

/**
 * Alerta de red flags (silencio, tardanza, faltantes, calificación baja): al inicio del
 * dashboard muestra el alcance "de casa" de quien la ve (su equipo, y para Iván también sus
 * equipos secundarios); dentro del detalle de un equipo se le pasa `team` para acotarla a ese
 * equipo puntual. Colapsada por default — la lista completa puede ser larga.
 *
 * Las vacaciones nunca son una red flag (ni alta ni media): viven en su propia sección amarilla,
 * separada de "Red flags detectadas" y sin contar para ese total.
 */
export default function RedFlagsPanel({ onOpenPerson, team }: { onOpenPerson: (email: string) => void; team?: string }) {
  const [people, setPeople] = useState<PersonRedFlags[] | null>(null);
  const [vacations, setVacations] = useState<VacationStatus[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [vacationsExpanded, setVacationsExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPeople(null);
    setVacations([]);
    fetchRedFlags(team)
      .then(d => {
        if (cancelled) return;
        setPeople(d.people);
        setVacations(d.vacations);
      })
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, [team]);

  if ((!people || people.length === 0) && vacations.length === 0) return null;

  return (
    <div className="space-y-3">
      {people && people.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-amber-100/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="font-display font-semibold text-sm text-amber-900">
                Red flags detectadas · {people.length} persona{people.length === 1 ? '' : 's'}
              </span>
            </span>
            {expanded ? <ChevronUp size={16} className="text-amber-700" /> : <ChevronDown size={16} className="text-amber-700" />}
          </button>
          {expanded && (
            <div className="grid sm:grid-cols-2 gap-2 p-4 pt-0">
              {people.map(p => {
                const hasAlta = p.flags.some(f => f.severity === 'alta');
                return (
                  <button
                    key={p.email}
                    onClick={() => onOpenPerson(p.email)}
                    className={`text-left rounded-lg border p-3 bg-white hover:border-toroto-primary transition-colors ${
                      hasAlta ? 'border-red-200' : 'border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[#0b1c30]">{p.fullName}</p>
                      <ChevronRight size={14} className="text-slate-400 shrink-0" />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{p.team}</p>
                    <ul className="mt-2 space-y-1">
                      {p.flags.slice(0, 2).map((f, i) => (
                        <li
                          key={i}
                          className={`text-xs flex gap-1.5 ${f.severity === 'alta' ? 'text-red-700' : 'text-amber-700'}`}
                        >
                          <span className="mt-0.5">•</span>
                          <span>{f.message}</span>
                        </li>
                      ))}
                      {p.flags.length > 2 && <li className="text-xs text-slate-400">+{p.flags.length - 2} más</li>}
                    </ul>
                    <p className="text-[11px] text-slate-500 mt-2 italic">{p.recommendation}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {vacations.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 overflow-hidden">
          <button
            onClick={() => setVacationsExpanded(v => !v)}
            className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-emerald-100/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Palmtree size={16} className="text-emerald-600" />
              <span className="font-display font-semibold text-sm text-emerald-900">
                De vacaciones · {vacations.length} persona{vacations.length === 1 ? '' : 's'}
              </span>
            </span>
            {vacationsExpanded ? (
              <ChevronUp size={16} className="text-emerald-700" />
            ) : (
              <ChevronDown size={16} className="text-emerald-700" />
            )}
          </button>
          {vacationsExpanded && (
            <div className="grid sm:grid-cols-2 gap-2 p-4 pt-0">
              {vacations.map(v => (
                <button
                  key={v.email}
                  onClick={() => onOpenPerson(v.email)}
                  className={`text-left rounded-lg border p-3 bg-white hover:border-toroto-primary transition-colors ${
                    v.isMaternity ? 'border-pink-200' : 'border-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-[#0b1c30]">{v.fullName}</p>
                    <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{v.team}</p>
                  <p className={`text-xs mt-2 ${v.isMaternity ? 'text-pink-700' : 'text-emerald-700'}`}>{v.message}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
