import { useEffect, useState } from 'react';
import { api, TOKEN_KEY, type Me } from './lib/apiClient.ts';
import Login from './components/Login.tsx';
import Shell from './components/Shell.tsx';
import Dashboard from './components/Dashboard.tsx';
import TeamDetail from './components/TeamDetail.tsx';
import PersonDetail from './components/PersonDetail.tsx';
import FeedbackInbox from './components/FeedbackInbox.tsx';

type View =
  | { name: 'overview' }
  | { name: 'team'; team: string }
  | { name: 'person'; email: string }
  | { name: 'feedback' };

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState<View>({ name: 'overview' });

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    api('/api/me')
      .then(setMe)
      .catch(e => {
        localStorage.removeItem(TOKEN_KEY);
        setAuthError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!me) return <Login initialError={authError} />;

  return (
    <Shell me={me} view={view.name} onNavigate={name => setView({ name } as View)}>
      {view.name === 'overview' && (
        <Dashboard
          me={me}
          onOpenTeam={team => setView({ name: 'team', team })}
          onOpenPerson={email => setView({ name: 'person', email })}
          onOpenFeedback={() => setView({ name: 'feedback' })}
        />
      )}
      {view.name === 'team' && (
        <TeamDetail
          me={me}
          team={view.team}
          onBack={() => setView({ name: 'overview' })}
          onOpenPerson={email => setView({ name: 'person', email })}
        />
      )}
      {view.name === 'person' && (
        <PersonDetail me={me} email={view.email} onBack={() => setView({ name: 'overview' })} />
      )}
      {view.name === 'feedback' && me.canSeeFeedback && <FeedbackInbox name={me.name} />}
    </Shell>
  );
}
