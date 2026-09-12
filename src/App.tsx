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
  // `me` es siempre lo que debe verse en pantalla: la cuenta real, o el perfil que Angie está
  // simulando con "Ver como" (src/lib/orgPermissions.ts) — el backend calcula todo (alcance,
  // canSeeFeedback, canManageRecognitions) para esa identidad efectiva. `canUseViewAs` y
  // `viewAsOptions` son la única excepción: el backend los calcula siempre a partir de la
  // sesión real, para que el control "Ver como" siga visible aunque se esté viendo como otra
  // persona.
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

  const setViewAs = (email: string) => {
    setViewAsEmail(email);
    setView({ name: 'overview' });
    api('/api/me')
      .then(setMe)
      .catch(() => {});
  };

  if (loading) return null;
  if (!me) return <Login initialError={authError} />;

  return (
    <Shell me={me} view={view.name} onNavigate={name => setView({ name } as View)}>
      {view.name === 'overview' && (
        <Dashboard
          key={me.email}
          me={me}
          onSetViewAs={setViewAs}
          onOpenTeam={team => setView({ name: 'team', team })}
          onOpenPerson={email => setView({ name: 'person', email })}
          onOpenRecognitions={() => setView({ name: 'recognitions' })}
        />
      )}
      {view.name === 'team' && (
        <TeamDetail
          me={me}
          onSetViewAs={setViewAs}
          team={view.team}
          onBack={() => setView({ name: 'overview' })}
          onOpenPerson={email => setView({ name: 'person', email })}
        />
      )}
      {view.name === 'person' && (
        <PersonDetail me={me} onSetViewAs={setViewAs} email={view.email} onBack={() => setView({ name: 'overview' })} />
      )}
      {view.name === 'feedback' && me.canSeeFeedback && <FeedbackInbox me={me} />}
      {view.name === 'recognitions' &&
        (me.canManageRecognitions ? (
          <RecognitionsAdmin me={me} onSetViewAs={setViewAs} onBack={() => setView({ name: 'overview' })} />
        ) : (
          <RecognitionsGallery me={me} onSetViewAs={setViewAs} onBack={() => setView({ name: 'overview' })} />
        ))}
    </Shell>
  );
}
