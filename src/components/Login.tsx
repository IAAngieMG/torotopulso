import { useEffect, useState } from 'react';
import { TOKEN_KEY } from '../lib/apiClient.ts';

declare global {
  interface Window {
    google: any;
  }
}

export default function Login({ initialError }: { initialError?: string }) {
  const [error, setError] = useState(initialError || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        const c = await fetch('/api/config').then(r => r.json());
        if (!c.oauthConfigured || !c.googleClientId) {
          setError(c.oauthConfigurationError || 'GOOGLE_CLIENT_ID no está configurado.');
          return;
        }
        const setup = () => {
          if (done || !window.google?.accounts?.id) return;
          try {
            window.google.accounts.id.initialize({
              client_id: c.googleClientId,
              callback: async (x: any) => {
                setLoading(true);
                setError('');
                try {
                  const r = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ credential: x.credential }),
                  });
                  const d = await r.json();
                  if (!r.ok) {
                    setError(d.error || 'No fue posible iniciar sesión.');
                    setLoading(false);
                    return;
                  }
                  localStorage.setItem(TOKEN_KEY, d.sessionToken);
                  location.reload();
                } catch {
                  setError('Error de conexión al validar con el servidor.');
                  setLoading(false);
                }
              },
            });
            const btnEl = document.getElementById('googleButton');
            if (btnEl) {
              window.google.accounts.id.renderButton(btnEl, {
                theme: 'outline',
                size: 'large',
                shape: 'pill',
                text: 'continue_with',
                width: 320,
              });
            }
          } catch (e: any) {
            console.error('Error rendering Google Sign-In:', e);
          }
        };

        if (!window.google?.accounts?.id) {
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.async = true;
          s.defer = true;
          s.onload = setup;
          document.head.appendChild(s);
        } else {
          setup();
        }
      } catch {
        setError('No se pudo inicializar la configuración de Google Sign-In.');
      }
    })();
    return () => {
      done = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="md:w-1/2 bg-gradient-to-br from-toroto-primary to-toroto-primary-dark text-white flex flex-col justify-between p-8 md:p-16">
        <img src="/toroto-logo-white.png" alt="Toroto" width={69} height={32} className="h-8 w-auto self-start" />
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide uppercase mb-6">
            ★ Pulso de la tropa
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-tight mb-4">
            El pulso de nuestra tropa, en vivo.
          </h1>
          <p className="text-white/80 text-base max-w-md">
            Encuestas diarias, tendencias semanales y el clima de cada equipo de Toroto, conectados en un solo lugar.
          </p>
        </div>
        <p className="text-white/60 text-xs">Un futuro compatible con la vida · Toroto S.A.P.I. de C.V.</p>
      </div>

      <div className="md:w-1/2 flex items-center justify-center p-8 bg-toroto-surface">
        <div className="w-full max-w-sm bg-white rounded-xl border border-toroto-border p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <img src="/toroto-logo-blue.png" alt="Toroto" width={52} height={24} className="h-6 w-auto" />
            <span className="text-sm text-slate-500">Pulso</span>
          </div>
          <h2 className="font-display text-xl font-semibold mb-2">Iniciar sesión</h2>
          <p className="text-sm text-slate-500 mb-6">
            Acceso exclusivo para líderes y dirección de TOROTO. Usa tu cuenta institucional con terminación{' '}
            <span className="font-medium text-slate-700">@toroto.mx</span>.
          </p>

          {error && (
            <div className="rounded-lg bg-toroto-critical-bg border border-red-200 text-red-700 text-sm p-3 mb-4">
              <p className="font-semibold mb-0.5">Error de acceso</p>
              <p>{error}</p>
            </div>
          )}

          <div id="googleButton" className="flex justify-center min-h-[44px]" />
          {loading && <p className="text-sm text-slate-500 mt-3 text-center">Validando…</p>}
        </div>
      </div>
    </div>
  );
}
