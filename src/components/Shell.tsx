import type { ReactNode } from 'react';
import { LogOut, Home, MessageCircleHeart, Award } from 'lucide-react';
import { TOKEN_KEY, type Me } from '../lib/apiClient.ts';

interface ShellProps {
  me: Me;
  view: string;
  onNavigate: (view: string) => void;
  children: ReactNode;
}

export default function Shell({ me, view, onNavigate, children }: ShellProps) {
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  };

  const navItems = [{ id: 'overview', label: 'Resumen y Pulso', icon: Home }];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-toroto-surface">
      <aside className="md:w-64 bg-[#0b1c30] text-white flex md:flex-col justify-between md:min-h-screen">
        <div className="p-4 md:p-5 flex md:flex-col items-center md:items-stretch gap-4 md:gap-8 w-full">
          <div className="flex items-center gap-2">
            <img src="/toroto-logo-white.png" alt="Toroto" width={52} height={24} className="h-6 w-auto" />
            <div className="hidden md:block">
              <p className="font-display font-semibold text-sm leading-tight">Pulso Toroto</p>
              <p className="text-[11px] text-white/50 leading-tight">El pulso de nuestra tropa</p>
            </div>
          </div>
          <nav className="flex md:flex-col gap-1 flex-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  view === item.id ? 'bg-toroto-primary text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <item.icon size={16} />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            ))}
            {me.canSeeFeedback && (
              <button
                onClick={() => onNavigate('feedback')}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  view === 'feedback' ? 'bg-toroto-primary text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                <MessageCircleHeart size={16} />
                <span className="hidden md:inline">Feedback recibido</span>
              </button>
            )}
          </nav>
        </div>
        <div className="hidden md:block p-4 border-t border-white/10">
          <p className="text-sm font-medium">{me.name}</p>
          <p className="text-xs text-white/50 mb-3">{me.email}</p>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function TopBar({ me, extra, onSetViewAs }: { me: Me; extra?: ReactNode; onSetViewAs?: (email: string) => void }) {
  const scopeLine =
    !me.visionGlobal && me.primaryTeam
      ? me.secondaryTeams.length > 0
        ? `Tu equipo: ${me.primaryTeam} · + ${me.secondaryTeams.length} equipo${me.secondaryTeams.length === 1 ? '' : 's'} secundario${me.secondaryTeams.length === 1 ? '' : 's'} a tu cargo`
        : ''
      : '';

  return (
    <div className="border-b border-toroto-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-4">
        <div>
          <h1 className="font-display text-xl font-semibold">
            Hola {me.name}{' '}
            <span className="inline-flex items-center gap-1 align-middle text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> En vivo
            </span>
          </h1>
          {scopeLine && <p className="text-sm text-slate-500 mt-0.5">{scopeLine}</p>}
        </div>
        <div className="flex items-center gap-2">
          {extra}
          {me.canUseViewAs && onSetViewAs && (
            <select
              value={me.isViewingAs ? me.email : ''}
              onChange={e => onSetViewAs(e.target.value)}
              className="text-xs rounded-lg border border-toroto-border px-2.5 py-1.5 bg-white"
              title="Ver el dashboard como otro perfil, solo para verificar"
            >
              <option value="">Ver como…</option>
              {me.viewAsOptions.map(o => (
                <option key={o.email} value={o.email}>
                  Ver como {o.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      {me.isViewingAs && (
        <div className="px-4 md:px-8 pb-3 -mt-1">
          <p className="inline-flex flex-wrap items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
            Viendo como {me.name}
            {onSetViewAs && (
              <button onClick={() => onSetViewAs('')} className="underline font-semibold hover:no-underline">
                Volver a mi vista
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

/** Píldora festiva + indicador de Slack que acompañan el encabezado de las vistas de Reconocimientos. */
export function ReconocimientosHeaderExtras() {
  return (
    <>
      <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
        Reconocimientos del mes
      </span>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-toroto-border text-[#0b1c30] text-xs font-medium">
        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
        Slack Conectado <span className="text-slate-400 font-normal">#reconocimientos</span>
      </span>
    </>
  );
}

export function ReconocimientosCard({
  onOpenRecognitions,
  isManager,
}: {
  onOpenRecognitions: () => void;
  isManager: boolean;
}) {
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4">
      <button onClick={onOpenRecognitions} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity w-full">
        <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <Award size={16} className="text-amber-600" />
        </div>
        <div>
          <p className="font-display font-semibold text-sm">Reconocimientos del mes</p>
          <p className="text-xs text-slate-500">
            {isManager ? 'Revisa y publica los diplomas del mes.' : 'Ver a quién reconocimos este mes.'}
          </p>
        </div>
      </button>
    </div>
  );
}
