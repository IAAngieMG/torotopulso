import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Me } from '../lib/apiClient.ts';
import { TopBar } from './Shell.tsx';
import YearReviewLeader from './YearReviewLeader.tsx';
import YearReviewRh from './YearReviewRh.tsx';

interface YearReviewProps {
  me: Me;
  onSetViewAs: (email: string) => void;
  onBack: () => void;
  onOpenPerson: (email: string) => void;
}

/** Resumen del año: contenedor único. Si la persona tiene ambos accesos (ej. Patricia, líder de RH
 * y además en la lista de RH), se le dan pestañas para alternar entre su equipo y toda la tropa. */
export default function YearReview({ me, onSetViewAs, onBack, onOpenPerson }: YearReviewProps) {
  const yr = me.yearReview;
  const [tab, setTab] = useState<'leader' | 'rh'>(yr?.canSeeLeader ? 'leader' : 'rh');

  if (!yr || (!yr.canSeeLeader && !yr.canSeeRh)) return null;
  const showTabs = yr.canSeeLeader && yr.canSeeRh;

  return (
    <div>
      <TopBar me={me} onSetViewAs={onSetViewAs} />
      <div className="p-4 md:p-8 space-y-6 max-w-5xl">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft size={14} /> Volver al dashboard
        </button>

        {showTabs && (
          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab('leader')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                tab === 'leader' ? 'bg-white shadow-sm text-[#0b1c30]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Mi equipo
            </button>
            <button
              onClick={() => setTab('rh')}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                tab === 'rh' ? 'bg-white shadow-sm text-[#0b1c30]' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Toda la tropa
            </button>
          </div>
        )}

        {tab === 'leader' && yr.canSeeLeader ? <YearReviewLeader onOpenPerson={onOpenPerson} /> : <YearReviewRh />}
      </div>
    </div>
  );
}
