import type { ResponseRecord } from './pulseData.ts';

/**
 * Detección de "red flags" por persona a partir de su propio historial de respuestas — sin IA
 * generativa, son reglas deterministas sobre los datos que ya trae el Sheet:
 *
 *  - Silencio: no respondió ninguna encuesta en varios días hábiles seguidos.
 *  - Inicio del día (BD) tarde: respondió después de las 10:00 am hora CDMX.
 *  - Alimentos / Cierre del día (AL/BT) sin contestar: un día en el que sí participó (respondió
 *    algo) pero se saltó ese slot puntual.
 *  - Calificación baja: cualquier respuesta con calificación menor a 4/5.
 *
 * Cada persona con al menos una red flag recibe además una recomendación: buscarla directamente
 * y, si hace falta, pedir apoyo a RH.
 */

const DAY_MS = 86400000;
const MEXICO_TZ = 'America/Mexico_City';
const LOW_SCORE_THRESHOLD = 4;
const LATE_MORNING_HOUR = 10;
const SILENT_WEEKDAYS_THRESHOLD = 3;
const SILENCE_LOOKBACK_WEEKDAYS = 10;
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

function isWeekdayKey(dateKey: string): boolean {
  const day = new Date(`${dateKey}T12:00:00`).getDay();
  return day >= 1 && day <= 5;
}

/** Cuenta días hábiles consecutivos sin ninguna respuesta, retrocediendo desde `now` hasta el último día con actividad. */
function countSilentWeekdays(datesWithResponse: Set<string>, now: Date): number {
  let silent = 0;
  for (let i = 0; i < SILENCE_LOOKBACK_WEEKDAYS; i++) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const key = localDateKey(d.toISOString());
    if (!isWeekdayKey(key)) continue;
    if (datesWithResponse.has(key)) break;
    silent++;
  }
  return silent;
}

const SEVERITY_RANK: Record<RedFlagSeverity, number> = { alta: 0, media: 1 };

function sortFlags(flags: RedFlag[]): RedFlag[] {
  return [...flags].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Calcula las red flags de una persona a partir de sus propias respuestas (ya filtradas a ella). */
export function computeRedFlagsForPerson(records: ResponseRecord[], now = new Date(), windowDays = 14): RedFlag[] {
  const cutoff = new Date(now.getTime() - windowDays * DAY_MS);
  const recent = records.filter(r => {
    const t = new Date(r.timestamp);
    return !Number.isNaN(t.getTime()) && t >= cutoff && t <= now;
  });

  const flags: RedFlag[] = [];

  const datesWithResponse = new Set(recent.map(r => localDateKey(r.timestamp)));
  const silentDays = countSilentWeekdays(datesWithResponse, now);
  if (silentDays >= SILENT_WEEKDAYS_THRESHOLD) {
    flags.push({
      type: 'silence',
      severity: 'alta',
      message: `No ha respondido ninguna encuesta en los últimos ${silentDays} días hábiles.`,
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

  const lowScores = [...recent]
    .filter(r => r.rawScore !== null && (r.rawScore as number) < LOW_SCORE_THRESHOLD)
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
    const flags = computeRedFlagsForPerson(byEmail.get(person.email) || [], now);
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
