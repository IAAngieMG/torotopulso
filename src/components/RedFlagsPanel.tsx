import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { fetchRedFlags, type PersonRedFlags } from '../lib/apiClient.ts';

/** Alerta al inicio del dashboard: quién tiene red flags (silencio, tardanza, faltantes, calificación baja) esta quincena. */
export default function RedFlagsPanel({ onOpenPerson }: { onOpenPerson: (email: string) => void }) {
  const [people, setPeople] = useState<PersonRedFlags[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRedFlags()
      .then(d => !cancelled && setPeople(d.people))
      .catch(() => !cancelled && setPeople([]));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!people || people.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-amber-600" />
        <p className="font-display font-semibold text-sm text-amber-900">
          Red flags detectadas · {people.length} persona{people.length === 1 ? '' : 's'}
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
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
    </div>
  );
}
