import { useEffect, useState } from 'react';
import { api, setViewAsEmail, TOKEN_KEY, type Me } from './lib/apiClient.ts';
import Login from './components/Login.tsx';
import Shell from './components/Shell.tsx';
import Dashboard from './components/Dashboard.tsx';
import TeamDetail from './components/TeamDetail.tsx';
import PersonDetail from './components/PersonDetail.tsx';
import FeedbackInbox from './components/FeedbackInbox.tsx';
import RecognitionsAdmin from './components/RecognitionsAdmin.tsx';
import RecognitionsGallery from './components/RecognitionsGallery.tsx';

type View =
  | { name: 'overview' }
  | { name: 'team'; team: string }
  | { name: 'person'; email: string }
  | { name: 'feedback' }
  | { name: 'recognitions' };

export default function App() {
  // `realMe` es siempre la cuenta que inició sesión de verdad — gobierna el shell, Reconocimientos
  // y Feedback. `effectiveMe` es lo que debe verse dentro del dashboard de pulso: igual a `realMe`
  // normalmente, o el perfil que Angie está simulando con "Ver como" (src/lib/orgPermissions.ts).
  const [realMe, setRealMe] = useState<Me | null>(null);
  const [effectiveMe, setEffectiveMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState<View>({ name: 'overview' });

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    api('/api/me')
      .then(m => {
        setRealMe(m);
        setEffectiveMe(m);
      })
      .catch(e => {
        localStorage.removeItem(TOKEN_KEY);
        setAuthError(e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const setViewAs = (email: string) => {
    setViewAsEmail(email);
    setView({ name: 'overview' });
    if (!email) {
      setEffectiveMe(realMe);
      return;
    }
    api('/api/me')
      .then(setEffectiveMe)
      .catch(() => {});
  };

  if (loading) return null;
  if (!realMe || !effectiveMe) return <Login initialError={authError} />;

  return (
    <Shell me={realMe} view={view.name} onNavigate={name => setView({ name } as View)}>
      {view.name === 'overview' && (
        <Dashboard
          key={effectiveMe.email}
          me={effectiveMe}
          onSetViewAs={setViewAs}
          onOpenTeam={team => setView({ name: 'team', team })}
          onOpenPerson={email => setView({ name: 'person', email })}
          onOpenFeedback={() => setView({ name: 'feedback' })}
          onOpenRecognitions={() => setView({ name: 'recognitions' })}
        />
      )}
      {view.name === 'team' && (
        <TeamDetail
          me={effectiveMe}
          onSetViewAs={setViewAs}
          team={view.team}
          onBack={() => setView({ name: 'overview' })}
          onOpenPerson={email => setView({ name: 'person', email })}
        />
      )}
      {view.name === 'person' && (
        <PersonDetail me={effectiveMe} onSetViewAs={setViewAs} email={view.email} onBack={() => setView({ name: 'overview' })} />
      )}
      {view.name === 'feedback' && realMe.canSeeFeedback && <FeedbackInbox me={realMe} />}
      {view.name === 'recognitions' &&
        (realMe.canManageRecognitions ? (
          <RecognitionsAdmin me={realMe} onBack={() => setView({ name: 'overview' })} />
        ) : (
          <RecognitionsGallery me={realMe} onBack={() => setView({ name: 'overview' })} />
        ))}
    </Shell>
  );
}
