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

export function TopBar({ name, extra }: { name: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-4 border-b border-toroto-border bg-white">
      <div>
        <h1 className="font-display text-xl font-semibold">
          Hola {name}{' '}
          <span className="inline-flex items-center gap-1 align-middle text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> En vivo
          </span>
        </h1>
      </div>
      <div className="flex items-center gap-2">{extra}</div>
    </div>
  );
}

export function ReconocimientosCard({
  onOpenRecognitions,
  onOpenFeedback,
  canSeeFeedback,
  isManager,
}: {
  onOpenRecognitions: () => void;
  onOpenFeedback: () => void;
  canSeeFeedback: boolean;
  isManager: boolean;
}) {
  return (
    <div className="rounded-xl border border-toroto-border bg-white p-4 flex items-center justify-between gap-3 flex-wrap">
      <button onClick={onOpenRecognitions} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
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
      {canSeeFeedback && (
        <button
          onClick={onOpenFeedback}
          className="text-sm font-medium text-toroto-primary hover:underline flex items-center gap-1"
        >
          <MessageCircleHeart size={14} /> Ver feedback
        </button>
      )}
    </div>
  );
}
