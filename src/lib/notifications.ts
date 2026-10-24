/**
 * Notificaciones de Pulso: feedback nuevo, respuesta en un hilo de feedback, y encuesta pendiente
 * por contestar. Un mismo arreglo (persistido en Netlify Blobs, igual que `feedback` en
 * server.ts) guarda las de todas las personas; cada quien solo ve las suyas (filtradas por
 * `email`). Se muestran en la campanita del dashboard y, si hay un proveedor de correo
 * configurado (ver `email.ts`), también se envían por correo.
 */
export type NotificationType = 'feedback_new' | 'feedback_reply' | 'survey_pending';

export interface NotificationEntry {
  id: string;
  /** Correo del destinatario, siempre en minúsculas. */
  email: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Hash de la app a donde debe llevar al hacer clic, ej. "#/feedback". */
  link: string;
  createdAt: string;
  readAt: string | null;
  /** Dato libre para deduplicar (ej. el qCode de la encuesta pendiente) — no se muestra en la UI. */
  meta?: string;
}

const norm = (s: string): string => s.trim().toLowerCase();

export function buildNotification(input: {
  email: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  meta?: string;
}): NotificationEntry {
  return {
    id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: norm(input.email),
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    createdAt: new Date().toISOString(),
    readAt: null,
    meta: input.meta,
  };
}

export function sortNewestFirst(entries: NotificationEntry[]): NotificationEntry[] {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function notificationsFor(entries: NotificationEntry[], email: string): NotificationEntry[] {
  const target = norm(email);
  return sortNewestFirst(entries.filter(e => e.email === target));
}

export function unreadCountFor(entries: NotificationEntry[], email: string): number {
  const target = norm(email);
  return entries.filter(e => e.email === target && !e.readAt).length;
}
