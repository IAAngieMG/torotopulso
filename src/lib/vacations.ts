/**
 * Vacaciones y ausencias conocidas del equipo. Mientras esté activa, la persona:
 *  - `scope: 'all'` — no cuenta como red flag y sale de los cálculos de participación de
 *    ningún signal (no está trabajando, no tiene caso esperar respuestas suyas).
 *  - `scope: 'VIERNES'` — solo se excluye de la Encuesta Viernes (participación y red flags de
 *    ese signal); sigue contando normal en Inicio del día / Alimentos / Cierre del día.
 * `from` es opcional (si no se da, se considera activa desde siempre hasta `until`).
 */
export interface VacationPeriod {
  email: string;
  until: string; // YYYY-MM-DD, inclusive
  from?: string; // YYYY-MM-DD, inclusive
  scope: 'all' | 'VIERNES';
  reason: string;
}

export const VACATIONS: VacationPeriod[] = [
  { email: 'emiliano@toroto.mx', until: '2026-10-05', scope: 'all', reason: 'Vacaciones' },
  { email: 'david@toroto.mx', from: '2026-10-05', until: '2026-10-26', scope: 'all', reason: 'Vacaciones' },
  { email: 'valentina@toroto.mx', from: '2026-10-08', until: '2026-10-12', scope: 'all', reason: 'Vacaciones' },
];

const norm = (s: string): string => s.trim().toLowerCase();

/** Fin de un día YYYY-MM-DD en hora local, para incluir todo ese día como "activo". */
function endOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
}

function startOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/** El período de vacaciones/ausencia activo de esa persona en `at`, si hay alguno. */
export function activeVacation(email: string, at: Date = new Date()): VacationPeriod | null {
  const target = norm(email);
  return (
    VACATIONS.find(v => {
      if (norm(v.email) !== target) return false;
      if (v.from && at < startOfDay(v.from)) return false;
      return at <= endOfDay(v.until);
    }) ?? null
  );
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatDateEs(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${d} de ${MESES[(m || 1) - 1]}${y !== new Date().getFullYear() ? ` de ${y}` : ''}`;
}

/** Leyenda corta para mostrar junto al nombre de la persona (ej. "De vacaciones hasta el 5 de octubre"). */
export function vacationLabel(period: VacationPeriod): string {
  return period.scope === 'all'
    ? `De vacaciones hasta el ${formatDateEs(period.until)}`
    : `${period.reason} hasta el ${formatDateEs(period.until)}`;
}

/** True si esa persona debe excluirse de la participación/expectativa de ese signal en `at`. */
export function isExcludedFromSignal(email: string, signal: string, at: Date = new Date()): boolean {
  const period = activeVacation(email, at);
  if (!period) return false;
  return period.scope === 'all' || period.scope === signal.toUpperCase();
}

/** Quita del roster a quien esté excluido de ese signal por vacaciones/ausencia. */
export function filterVacationingEmails(emails: Iterable<string>, signal: string, at: Date = new Date()): string[] {
  return [...emails].filter(email => !isExcludedFromSignal(email, signal, at));
}
