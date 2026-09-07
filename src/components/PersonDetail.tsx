import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { fetchPersonDetail, type Me, type PersonDetail as PersonDetailData, type RangeOption, type SignalOption } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';
import { KpiGrid, RangeSignalControls } from './PulseWidgets.tsx';

const QCODE_LABEL: Record<string, string> = { BD: 'Inicio del día', AL: 'Alimentos', BT: 'Cierre del día' };

export default function PersonDetail({ me, email, onBack }: { me: Me; email: string; onBack: () => void }) {
  const [range, setRange] = useState<RangeOption>('week');
  const [signal, setSignal] = useState<SignalOption>('ALL');
  const [data, setData] = useState<PersonDetailData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchPersonDetail(email, range, signal)
      .then(d => !cancelled && setData(d))
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [email, range, signal]);

  return (
    <div>
      <TopBar name={me.name} />
      <div className="p-4 md:p-8 space-y-6 max-w-3xl">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver
        </button>

        <div>
          <h2 className="font-display text-lg font-semibold">{data?.fullName || email}</h2>
          <p className="text-sm text-slate-500">{email}{data?.teams.length ? ` · ${data.teams.join(', ')}` : ''}</p>
        </div>

        <RangeSignalControls range={range} onRange={setRange} signal={signal} onSignal={setSignal} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="text-sm text-slate-500">Cargando…</p>}

        {data && (
          <>
            <KpiGrid kpis={data.kpis} />
            <div className="rounded-xl border border-toroto-border bg-white p-4">
              <p className="font-display font-semibold text-sm mb-3">Historial de respuestas</p>
              {data.responses.length === 0 && <p className="text-sm text-slate-500">Sin respuestas en este rango.</p>}
              <div className="divide-y divide-toroto-border">
                {data.responses.map((r, i) => (
                  <div key={i} className="py-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">{QCODE_LABEL[r.qCode] || r.qCode}</p>
                      <p className="text-sm text-[#0b1c30]">{r.question}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{r.rawScore != null ? `${r.rawScore}/5` : '—'}</p>
                      <p className="text-[11px] text-slate-400">{new Date(r.timestamp).toLocaleString('es-MX')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
