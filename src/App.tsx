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

/**
 * La vista completa vive en `location.hash` (no solo en estado de React) para que el botón de
 * regresar/adelantar del navegador funcione dentro de la app: cada navegación agrega una entrada
 * de historial real, y `popstate`/`hashchange` reconstruyen el estado al ir hacia atrás o
 * adelante, en vez de sacar a la persona de Pulso Toroto por completo.
 */
function viewToHash(view: View): string {
  switch (view.name) {
    case 'overview':
      return '#/';
    case 'team':
      return `#/team/${encodeURIComponent(view.team)}`;
    case 'person':
      return `#/person/${encodeURIComponent(view.email)}`;
    case 'feedback':
      return '#/feedback';
    case 'recognitions':
      return '#/recognitions';
  }
}

function hashToView(hash: string): View {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'team' && parts[1]) return { name: 'team', team: decodeURIComponent(parts[1]) };
  if (parts[0] === 'person' && parts[1]) return { name: 'person', email: decodeURIComponent(parts[1]) };
  if (parts[0] === 'feedback') return { name: 'feedback' };
  if (parts[0] === 'recognitions') return { name: 'recognitions' };
  return { name: 'overview' };
}

export default function App() {
  // `me` es siempre lo que debe verse en pantalla: la cuenta real, o el perfil que Angie o Karla
  // están simulando con "Ver como" (src/lib/orgPermissions.ts) — el backend calcula todo (alcance,
  // canSeeFeedback, canManageRecognitions) para esa identidad efectiva. `canUseViewAs` y
  // `viewAsOptions` son la única excepción: el backend los calcula siempre a partir de la
  // sesión real, para que el control "Ver como" siga visible aunque se esté viendo como otra
  // persona.
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [view, setView] = useState<View>(() => hashToView(window.location.hash));

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

  useEffect(() => {
    const onHashChange = () => setView(hashToView(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: View) => {
    const hash = viewToHash(next);
    if (window.location.hash === hash) {
      setView(next);
    } else {
      window.location.hash = hash;
    }
  };

  const setViewAs = (email: string) => {
    setViewAsEmail(email);
    navigate({ name: 'overview' });
    api('/api/me')
      .then(setMe)
      .catch(() => {});
  };

  if (loading) return null;
  if (!me) return <Login initialError={authError} />;

  return (
    <Shell me={me} view={view.name} onNavigate={name => navigate({ name } as View)}>
      {view.name === 'overview' && (
        <Dashboard
          key={me.email}
          me={me}
          onSetViewAs={setViewAs}
          onOpenTeam={team => navigate({ name: 'team', team })}
          onOpenPerson={email => navigate({ name: 'person', email })}
          onOpenRecognitions={() => navigate({ name: 'recognitions' })}
        />
      )}
      {view.name === 'team' && (
        <TeamDetail
          me={me}
          onSetViewAs={setViewAs}
          team={view.team}
          onBack={() => navigate({ name: 'overview' })}
          onOpenPerson={email => navigate({ name: 'person', email })}
        />
      )}
      {view.name === 'person' && (
        <PersonDetail me={me} onSetViewAs={setViewAs} email={view.email} onBack={() => navigate({ name: 'overview' })} />
      )}
      {view.name === 'feedback' && me.canSeeFeedback && <FeedbackInbox me={me} />}
      {view.name === 'recognitions' &&
        me.canViewRecognitions &&
        (me.canManageRecognitions ? (
          <RecognitionsAdmin me={me} onSetViewAs={setViewAs} onBack={() => navigate({ name: 'overview' })} />
        ) : (
          <RecognitionsGallery me={me} onSetViewAs={setViewAs} onBack={() => navigate({ name: 'overview' })} />
        ))}
    </Shell>
  );
}
