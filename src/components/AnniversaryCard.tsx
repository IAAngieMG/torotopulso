import { useEffect, useState } from 'react';
import { PartyPopper, ChevronDown, ChevronUp } from 'lucide-react';
import { fetchAnniversary, type AnniversaryTeamSummary } from '../lib/apiClient.ts';

/**
 * Tarjeta "7 años Toroto": resultados de la encuesta especial de aniversario (29 de octubre de
 * 2026), separada de las métricas normales. Solo se muestra del 2 al 8 de noviembre de 2026
 * (ver `isAnniversaryCardVisible` en src/lib/anniversary.ts) — antes y después el endpoint
 * devuelve `visible: false` y esta tarjeta no renderiza nada.
 *
 * Mismo patrón que `RedFlagsPanel`: sin `team` muestra el/los equipo(s) de casa de quien la ve
 * (varios para Iván Castro); con `team` se acota a ese equipo puntual dentro de su detalle.
 */
export default function AnniversaryCard({ team }: { team?: string }) {
  const [teams, setTeams] = useState<AnniversaryTeamSummary[] | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setTeams(null);
    fetchAnniversary(team)
      .then(d => !cancelled && setTeams(d.visible ? d.teams : []))
      .catch(() => !cancelled && setTeams([]));
    return () => {
      cancelled = true;
    };
  }, [team]);

  if (!teams || teams.length === 0) return null;

  return (
    <div className="space-y-3">
      {teams.map(summary => (
        <div key={summary.team} className="rounded-xl border border-rose-300 bg-rose-50 overflow-hidden">
          <button
            onClick={() => setExpanded(e => ({ ...e, [summary.team]: !e[summary.team] }))}
            className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-rose-100/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <PartyPopper size={16} className="text-rose-600" />
              <span className="font-display font-semibold text-sm text-rose-900">
                7 años Toroto · {summary.answered} de {summary.total} contestaron
              </span>
            </span>
            {expanded[summary.team] ? <ChevronUp size={16} className="text-rose-700" /> : <ChevronDown size={16} className="text-rose-700" />}
          </button>
          {expanded[summary.team] && (
            <div className="p-4 pt-0 space-y-3">
              <div className="grid sm:grid-cols-2 gap-2">
                {summary.distribution.map(d => (
                  <div key={d.choice} className="rounded-lg border border-rose-200 bg-white p-2.5 text-sm">
                    <span className="mr-1.5">{d.emoji}</span>
                    {d.label} — <span className="font-medium">{d.count}</span> ({d.pct}%)
                  </div>
                ))}
              </div>
              {summary.respondents.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-rose-800 mb-1.5">Quiénes contestaron</p>
                  <ul className="grid sm:grid-cols-2 gap-1">
                    {summary.respondents.map(r => (
                      <li key={r.email} className="text-xs text-slate-600">
                        {r.fullName} — {r.choiceLabel}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
