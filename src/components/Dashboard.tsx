import { useState } from 'react';
import { Globe2, Users, User, Star } from 'lucide-react';
import type { Me } from '../lib/apiClient.ts';
import { TopBar, ReconocimientosCard } from './Shell.tsx';
import Overview from './Overview.tsx';
import TeamsTable from './TeamsTable.tsx';
import PeopleList from './PeopleList.tsx';
import FeedbackWidget from './FeedbackWidget.tsx';
import RedFlagsPanel from './RedFlagsPanel.tsx';

type Tab = 'general' | 'equipos' | 'personas' | 'lideres';

function tabsFor(isVisionGlobal: boolean): Array<{ id: Tab; label: string; icon: typeof Globe2 }> {
  return [
    { id: 'general', label: isVisionGlobal ? 'General Toroto' : 'General', icon: Globe2 },
    { id: 'equipos', label: 'Equipos', icon: Users },
    { id: 'personas', label: 'Personas', icon: User },
    { id: 'lideres', label: 'Líderes', icon: Star },
  ];
}

interface DashboardProps {
  me: Me;
  onSetViewAs: (email: string) => void;
  onOpenTeam: (team: string) => void;
  onOpenPerson: (email: string) => void;
  onOpenRecognitions: () => void;
}

export default function Dashboard({ me, onSetViewAs, onOpenTeam, onOpenPerson, onOpenRecognitions }: DashboardProps) {
  const [tab, setTab] = useState<Tab>('general');
  const isVisionGlobal = me.visionGlobal;
  // Personas/Líderes/Equipos ya no son exclusivos de visión global: cualquier líder con acceso
  // otorgado puede elegir entre todos los equipos y personas dentro de su propio alcance.
  const showTabs = me.teams.length > 0;
  const TABS = tabsFor(isVisionGlobal);

  return (
    <div>
      <TopBar me={me} onSetViewAs={onSetViewAs} />
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        <RedFlagsPanel onOpenPerson={onOpenPerson} />

        {me.canViewRecognitions && <ReconocimientosCard onOpenRecognitions={onOpenRecognitions} isManager={me.canManageRecognitions} />}

        {showTabs && (
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

        {(!showTabs || tab === 'general') && <Overview me={me} onOpenTeam={onOpenTeam} />}
        {showTabs && tab === 'equipos' && <TeamsTable onOpenTeam={onOpenTeam} primaryTeam={isVisionGlobal ? undefined : me.primaryTeam} />}
        {showTabs && tab === 'personas' && <PeopleList onlyLeaders={false} onOpenPerson={onOpenPerson} />}
        {showTabs && tab === 'lideres' && <PeopleList onlyLeaders onOpenPerson={onOpenPerson} />}

        <FeedbackWidget view={showTabs ? `Resumen · ${tab}` : 'Resumen y Pulso'} />
      </div>
    </div>
  );
}
