import type { ResponseRecord } from './pulseData.ts';
import { rangeWindow } from './scoring.ts';
import { activeVacation } from './vacations.ts';

/**
 * Detección de "red flags" por persona a partir de su propio historial de respuestas — sin IA
 * generativa, son reglas deterministas sobre los datos que ya trae el Sheet, evaluadas sobre la
 * semana pasada completa (lunes a domingo anterior a hoy), no en tiempo real: así el resultado
 * no cambia según la hora del día ni queda a medias mientras avanza la semana en curso.
 *
 *  - Silencio: no respondió ninguna encuesta en varios días hábiles de la semana pasada.
 *  - Inicio del día (BD) tarde: respondió después de las 10:00 am hora CDMX.
 *  - Alimentos / Cierre del día (AL/BT) sin contestar: un día en el que sí participó (respondió
 *    algo) pero se saltó ese slot puntual.
 *  - Calificación baja: cualquier respuesta con calificación menor a 4/5.
 *
 * Quien esté de vacaciones (src/lib/vacations.ts) con alcance "all" no genera ninguna red flag.
 *
 * Cada persona con al menos una red flag recibe además una recomendación: buscarla directamente
 * y, si hace falta, pedir apoyo a RH.
 */

const MEXICO_TZ = 'America/Mexico_City';
const LOW_SCORE_THRESHOLD = 4;
const LATE_MORNING_HOUR = 10;
const SILENT_WEEKDAYS_THRESHOLD = 3;
const MAX_FLAGS_PER_PERSON = 6;

export type RedFlagType = 'silence' | 'late_morning' | 'missing_response' | 'low_score';
export type RedFlagSeverity = 'alta' | 'media';

export interface RedFlag {
  type: RedFlagType;
  severity: RedFlagSeverity;
  message: string;
}

export interface PersonRedFlags {
  email: string;
  fullName: string;
  team: string;
  flags: RedFlag[];
  recommendation: string;
}

const QCODE_LABEL: Record<string, string> = { BD: 'Inicio del día', AL: 'Alimentos', BT: 'Cierre del día' };

function localDateKey(iso: string, tz = MEXICO_TZ): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function localHour(iso: string, tz = MEXICO_TZ): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  const hourPart = parts.find(p => p.type === 'hour');
  return hourPart ? Number(hourPart.value) : d.getHours();
}

function localTimeLabel(iso: string, tz = MEXICO_TZ): string {
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}

function dateLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function ymdKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Fechas (lunes a viernes) dentro de [start, end), en el mismo formato YYYY-MM-DD que `localDateKey`. */
function weekdayKeysInRange(start: Date, end: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor < end) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) keys.push(ymdKey(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

const SEVERITY_RANK: Record<RedFlagSeverity, number> = { alta: 0, media: 1 };

function sortFlags(flags: RedFlag[]): RedFlag[] {
  return [...flags].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Calcula las red flags de una persona sobre la semana pasada, a partir de sus propias respuestas. */
export function computeRedFlagsForPerson(email: string, records: ResponseRecord[], now = new Date()): RedFlag[] {
  if (activeVacation(email, now)?.scope === 'all') return [];

  const { start, end } = rangeWindow('lastWeek', now);
  const recent = records.filter(r => {
    const t = new Date(r.timestamp);
    return !Number.isNaN(t.getTime()) && t >= start && t < end;
  });

  const flags: RedFlag[] = [];

  const datesWithResponse = new Set(recent.map(r => localDateKey(r.timestamp)));
  const weekdays = weekdayKeysInRange(start, end);
  const silentDays = weekdays.filter(k => !datesWithResponse.has(k)).length;
  if (silentDays >= SILENT_WEEKDAYS_THRESHOLD) {
    flags.push({
      type: 'silence',
      severity: 'alta',
      message: `No respondió ninguna encuesta en ${silentDays} de ${weekdays.length} días hábiles de la semana pasada.`,
    });
  }

  const byDate = new Map<string, ResponseRecord[]>();
  for (const r of recent) {
    const key = localDateKey(r.timestamp);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(r);
  }

  for (const [dateKey, dayRecords] of [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a))) {
    const bd = dayRecords.find(r => r.qCode === 'BD');
    if (bd && localHour(bd.timestamp) >= LATE_MORNING_HOUR) {
      flags.push({
        type: 'late_morning',
        severity: 'media',
        message: `Respondió "Inicio del día" a las ${localTimeLabel(bd.timestamp)} del ${dateLabel(dateKey)} (después de las 10:00 am).`,
      });
    }
    if (!dayRecords.some(r => r.qCode === 'AL')) {
      flags.push({ type: 'missing_response', severity: 'media', message: `No respondió "Alimentos" el ${dateLabel(dateKey)}.` });
    }
    if (!dayRecords.some(r => r.qCode === 'BT')) {
      flags.push({ type: 'missing_response', severity: 'media', message: `No respondió "Cierre del día" el ${dateLabel(dateKey)}.` });
    }
  }

  // "Alimentos" (AL) se responde con emojis, no con una calificación de calidad — un 1 ahí no
  // significa "mal", así que nunca cuenta para la red flag de calificación baja (solo importa si
  // participó o no, ya cubierto arriba por "missing_response").
  const lowScores = [...recent]
    .filter(r => r.qCode !== 'AL' && r.rawScore !== null && (r.rawScore as number) < LOW_SCORE_THRESHOLD)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  for (const r of lowScores) {
    flags.push({
      type: 'low_score',
      severity: 'alta',
      message: `Calificación baja (${r.rawScore}/5) en "${QCODE_LABEL[r.qCode] || r.qCode}" el ${dateLabel(localDateKey(r.timestamp))}.`,
    });
  }

  return sortFlags(flags).slice(0, MAX_FLAGS_PER_PERSON);
}

/** Texto de acción sugerido: buscar directamente a la persona y, si hace falta, pedir apoyo a RH. */
export function buildRecommendation(flags: RedFlag[]): string {
  const hasAlta = flags.some(f => f.severity === 'alta');
  return hasAlta
    ? 'Busca a la persona colaboradora para ver cómo está y, si lo necesitas, pide apoyo a RH.'
    : 'Vale la pena buscar a la persona colaboradora para ver cómo está.';
}

export interface RosterPerson {
  email: string;
  fullName: string;
  team: string;
}

/** Calcula red flags para todo un roster, devolviendo solo a quienes tengan al menos una. */
export function computeRedFlagsForRoster(roster: RosterPerson[], allRecords: ResponseRecord[], now = new Date()): PersonRedFlags[] {
  const byEmail = new Map<string, ResponseRecord[]>();
  for (const r of allRecords) {
    if (!byEmail.has(r.email)) byEmail.set(r.email, []);
    byEmail.get(r.email)!.push(r);
  }

  const result: PersonRedFlags[] = [];
  for (const person of roster) {
    const flags = computeRedFlagsForPerson(person.email, byEmail.get(person.email) || [], now);
    if (flags.length === 0) continue;
    result.push({ email: person.email, fullName: person.fullName, team: person.team, flags, recommendation: buildRecommendation(flags) });
  }

  return result.sort((a, b) => {
    const aAlta = a.flags.some(f => f.severity === 'alta') ? 0 : 1;
    const bAlta = b.flags.some(f => f.severity === 'alta') ? 0 : 1;
    if (aAlta !== bAlta) return aAlta - bAlta;
    return b.flags.length - a.flags.length;
  });
}
