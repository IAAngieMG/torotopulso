import { useState } from 'react';
import { Globe2, Users, User, Star } from 'lucide-react';
import type { Me } from '../lib/apiClient.ts';
import { TopBar, ReconocimientosCard } from './Shell.tsx';
import Overview from './Overview.tsx';
import TeamsTable from './TeamsTable.tsx';
import PeopleList from './PeopleList.tsx';
import FeedbackWidget from './FeedbackWidget.tsx';

type Tab = 'general' | 'equipos' | 'personas' | 'lideres';

const TABS: Array<{ id: Tab; label: string; icon: typeof Globe2 }> = [
  { id: 'general', label: 'General Toroto', icon: Globe2 },
  { id: 'equipos', label: 'Equipos', icon: Users },
  { id: 'personas', label: 'Personas', icon: User },
  { id: 'lideres', label: 'Líderes', icon: Star },
];

interface DashboardProps {
  me: Me;
  onSetViewAs: (email: string) => void;
  onOpenTeam: (team: string) => void;
  onOpenPerson: (email: string) => void;
  onOpenFeedback: () => void;
  onOpenRecognitions: () => void;
}

export default function Dashboard({ me, onSetViewAs, onOpenTeam, onOpenPerson, onOpenFeedback, onOpenRecognitions }: DashboardProps) {
  const [tab, setTab] = useState<Tab>('general');
  const isVisionGlobal = me.visionGlobal;

  return (
    <div>
      <TopBar me={me} onSetViewAs={onSetViewAs} />
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {isVisionGlobal && (
          <ReconocimientosCard
            onOpenRecognitions={onOpenRecognitions}
            onOpenFeedback={onOpenFeedback}
            canSeeFeedback={me.canSeeFeedback}
            isManager={me.canManageRecognitions}
          />
        )}

        {isVisionGlobal && (
          <div className="flex flex-wrap gap-1 bg-slate-100 rounded-lg p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                  tab === t.id ? 'bg-white shadow-sm text-[#0b1c30]' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </div>
        )}

        {(!isVisionGlobal || tab === 'general') && <Overview me={me} onOpenTeam={onOpenTeam} />}
        {isVisionGlobal && tab === 'equipos' && <TeamsTable onOpenTeam={onOpenTeam} />}
        {isVisionGlobal && tab === 'personas' && <PeopleList onlyLeaders={false} onOpenPerson={onOpenPerson} />}
        {isVisionGlobal && tab === 'lideres' && <PeopleList onlyLeaders onOpenPerson={onOpenPerson} />}

        <FeedbackWidget view={isVisionGlobal ? `Resumen · ${tab}` : 'Resumen y Pulso'} />
      </div>
    </div>
  );
}
