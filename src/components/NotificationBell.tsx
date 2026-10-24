import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, type NotificationEntry } from '../lib/apiClient.ts';

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'justo ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} d`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = () => {
    fetchNotifications()
      .then(d => {
        setNotifications(d.notifications);
        setUnreadCount(d.unreadCount);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const openNotification = (n: NotificationEntry) => {
    if (!n.readAt) {
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setUnreadCount(c => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link) window.location.hash = n.link.replace(/^#/, '');
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => {});
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-toroto-primary hover:bg-toroto-primary/5"
        title="Notificaciones"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-toroto-primary text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-toroto-border bg-white shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-toroto-border">
            <p className="font-display font-semibold text-sm">Notificaciones</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-toroto-primary font-medium hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          {notifications.length === 0 && <p className="text-sm text-slate-500 px-4 py-6 text-center">No tienes notificaciones.</p>}
          <div className="divide-y divide-toroto-border">
            {notifications.map(n => (
              <button
                key={n.id}
                onClick={() => openNotification(n)}
                className={`w-full text-left px-4 py-3 hover:bg-toroto-surface ${!n.readAt ? 'bg-toroto-primary/5' : ''}`}
              >
                <div className="flex items-start gap-2">
                  {!n.readAt && <span className="w-1.5 h-1.5 rounded-full bg-toroto-primary mt-1.5 shrink-0" />}
                  <div className={n.readAt ? 'pl-3.5' : ''}>
                    <p className="text-sm font-medium text-[#0b1c30]">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
