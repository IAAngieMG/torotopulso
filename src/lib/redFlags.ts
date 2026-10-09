import type { ResponseRecord } from './pulseData.ts';
import { rangeWindow } from './scoring.ts';
import { activeVacation } from './vacations.ts';

/**
 * Detección de "red flags" por persona a partir de su propio historial de respuestas — sin IA
 * generativa, son reglas deterministas sobre los datos que ya trae el Sheet, evaluadas sobre la
 * semana pasada completa (lunes a domingo anterior a hoy), no en tiempo real: así el resultado
 * no cambia según la hora del día ni queda a medias mientras avanza la semana en curso.
 *
 * Ninguna red flag se dispara por un incidente aislado de un solo día: todas piden un patrón de
 * más de `PATTERN_DAYS_THRESHOLD` (3) días hábiles de la semana pasada, no menos:
 *  - Silencio: no respondió ninguna encuesta.
 *  - Inicio del día (BD) tarde: respondió después de las 10:00 am hora CDMX.
 *  - Alimentos / Cierre del día (AL/BT) sin contestar: días en los que sí participó (respondió
 *    algo) pero se saltó ese slot puntual.
 *  - Calificación baja: respuestas con calificación menor a 4/5.
 *
 * Los días hábiles en los que la persona estaba de vacaciones (src/lib/vacations.ts, alcance
 * "all") no cuentan para ningún patrón (ni como silencio ni como parte del denominador), y en
 * vez de eso generan una "vacation" flag informativa (severidad `media`, se ve amarilla, no
 * roja) con la leyenda de que no se esperaba respuesta esos días — no es una red flag real. Los
 * días hábiles fuera del rango de vacaciones de esa misma semana siguen las reglas normales.
 *
 * Cada persona con al menos una red flag recibe además una recomendación puntual según el tipo
 * de red flag (no un genérico "busca a la persona"): por ejemplo distingue si dejó de contestar
 * de golpe tras ser constante o si ya venía respondiendo poco, o si una calificación baja es una
 * caída repentina frente a su promedio habitual o algo ya sostenido. Para eso compara la semana
 * evaluada contra las semanas previas de la misma persona (ver `buildFlagContext`).
 */

const MEXICO_TZ = 'America/Mexico_City';
const DAY_MS = 24 * 60 * 60 * 1000;
const LOW_SCORE_THRESHOLD = 4;
const LATE_MORNING_HOUR = 10;
/** Ninguna red flag se dispara por un solo día: todas piden más de este número de días con el patrón. */
const PATTERN_DAYS_THRESHOLD = 3;
const MAX_FLAGS_PER_PERSON = 6;
const CONTEXT_PRIOR_WEEKS = 3;

export type RedFlagType = 'silence' | 'late_morning' | 'missing_response' | 'low_score' | 'vacation';
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
  const { start, end } = rangeWindow('lastWeek', now);
  const recent = records.filter(r => {
    const t = new Date(r.timestamp);
    return !Number.isNaN(t.getTime()) && t >= start && t < end;
  });

  const flags: RedFlag[] = [];

  const datesWithResponse = new Set(recent.map(r => localDateKey(r.timestamp)));
  const weekdays = weekdayKeysInRange(start, end);
  // Días hábiles de la semana evaluada en los que la persona estaba de vacaciones (alcance
  // "all") — se excluyen del patrón de silencio (y de su denominador) y generan, en su lugar,
  // la flag informativa de vacaciones más abajo. El resto de la semana sigue las reglas normales.
  const vacationDays = weekdays.filter(k => activeVacation(email, new Date(`${k}T12:00:00`))?.scope === 'all');
  const workWeekdays = weekdays.filter(k => !vacationDays.includes(k));
  const silentDays = workWeekdays.filter(k => !datesWithResponse.has(k)).length;
  if (silentDays > PATTERN_DAYS_THRESHOLD) {
    flags.push({
      type: 'silence',
      severity: 'alta',
      message: `No respondió ninguna encuesta en ${silentDays} de ${workWeekdays.length} días hábiles de la semana pasada.`,
    });
  }

  const byDate = new Map<string, ResponseRecord[]>();
  for (const r of recent) {
    const key = localDateKey(r.timestamp);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(r);
  }
  // Días en los que sí participó (respondió algo), ordenados del más reciente al más antiguo.
  const activeDateKeys = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  const lateMorningDays = activeDateKeys.filter(dateKey => {
    const bd = byDate.get(dateKey)!.find(r => r.qCode === 'BD');
    return bd !== undefined && localHour(bd.timestamp) >= LATE_MORNING_HOUR;
  });
  if (lateMorningDays.length > PATTERN_DAYS_THRESHOLD) {
    const latestBd = byDate.get(lateMorningDays[0])!.find(r => r.qCode === 'BD')!;
    flags.push({
      type: 'late_morning',
      severity: 'media',
      message: `Respondió "Inicio del día" después de las 10:00 am en ${lateMorningDays.length} días de la semana pasada (el más reciente, a las ${localTimeLabel(latestBd.timestamp)} del ${dateLabel(lateMorningDays[0])}).`,
    });
  }

  const alMissingDays = activeDateKeys.filter(dateKey => !byDate.get(dateKey)!.some(r => r.qCode === 'AL'));
  if (alMissingDays.length > PATTERN_DAYS_THRESHOLD) {
    flags.push({
      type: 'missing_response',
      severity: 'media',
      message: `No respondió "Alimentos" en ${alMissingDays.length} días de la semana pasada, aunque sí participó esos días.`,
    });
  }

  const btMissingDays = activeDateKeys.filter(dateKey => !byDate.get(dateKey)!.some(r => r.qCode === 'BT'));
  if (btMissingDays.length > PATTERN_DAYS_THRESHOLD) {
    flags.push({
      type: 'missing_response',
      severity: 'media',
      message: `No respondió "Cierre del día" en ${btMissingDays.length} días de la semana pasada, aunque sí participó esos días.`,
    });
  }

  // "Alimentos" (AL) se responde con emojis, no con una calificación de calidad — un 1 ahí no
  // significa "mal", así que nunca cuenta para la red flag de calificación baja (solo importa si
  // participó o no, ya cubierto arriba por "missing_response").
  const lowScoreRecords = [...recent]
    .filter(r => r.qCode !== 'AL' && r.rawScore !== null && (r.rawScore as number) < LOW_SCORE_THRESHOLD)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const lowScoreDays = new Set(lowScoreRecords.map(r => localDateKey(r.timestamp)));
  if (lowScoreDays.size > PATTERN_DAYS_THRESHOLD) {
    const latest = lowScoreRecords[0];
    flags.push({
      type: 'low_score',
      severity: 'alta',
      message: `Calificación baja (menor a 4/5) en ${lowScoreDays.size} días de la semana pasada — la más reciente, ${latest.rawScore}/5 en "${QCODE_LABEL[latest.qCode] || latest.qCode}" el ${dateLabel(localDateKey(latest.timestamp))}.`,
    });
  }

  if (vacationDays.length > 0) {
    flags.push({
      type: 'vacation',
      severity: 'media',
      message: `De vacaciones ${vacationDays.length} de ${weekdays.length} días hábiles de la semana pasada — no se espera respuesta esos días.`,
    });
  }

  return sortFlags(flags).slice(0, MAX_FLAGS_PER_PERSON);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

/**
 * Señales de las semanas previas a la evaluada, para que la recomendación distinga un cambio
 * repentino (antes activo/alto, ahora no) de un patrón ya sostenido. `null` en cualquier campo
 * significa que no hay suficiente historial previo para opinar (nunca "no hay problema").
 */
export interface RedFlagContext {
  wasActiveBeforeSilence: boolean | null;
  priorAvgScore: number | null;
  recurringLateMorning: boolean | null;
}

const EMPTY_CONTEXT: RedFlagContext = { wasActiveBeforeSilence: null, priorAvgScore: null, recurringLateMorning: null };

/** Construye el contexto de las `CONTEXT_PRIOR_WEEKS` semanas anteriores a la semana evaluada. */
export function buildFlagContext(records: ResponseRecord[], now = new Date()): RedFlagContext {
  const { start } = rangeWindow('lastWeek', now);
  const priorStart = new Date(start.getTime() - CONTEXT_PRIOR_WEEKS * 7 * DAY_MS);
  const prior = records.filter(r => {
    const t = new Date(r.timestamp);
    return !Number.isNaN(t.getTime()) && t >= priorStart && t < start;
  });
  if (prior.length === 0) return EMPTY_CONTEXT;

  const priorWeekdays = weekdayKeysInRange(priorStart, start);
  const priorDatesWithResponse = new Set(prior.map(r => localDateKey(r.timestamp)));
  const priorSilentDays = priorWeekdays.filter(k => !priorDatesWithResponse.has(k)).length;
  const wasActiveBeforeSilence = priorWeekdays.length > 0 ? priorSilentDays / priorWeekdays.length <= 0.4 : null;

  const priorAvgScore = average(prior.filter(r => r.qCode !== 'AL' && r.rawScore !== null).map(r => r.rawScore as number));

  const priorBD = prior.filter(r => r.qCode === 'BD');
  const recurringLateMorning = priorBD.length > 0 ? priorBD.filter(r => localHour(r.timestamp) >= LATE_MORNING_HOUR).length / priorBD.length >= 0.5 : null;

  return { wasActiveBeforeSilence, priorAvgScore, recurringLateMorning };
}

/**
 * Texto de acción sugerido, específico al tipo de red flag más relevante (no un genérico "busca
 * a la persona"): usa `context` (ver `buildFlagContext`) para distinguir un cambio repentino de
 * un patrón sostenido cuando hay suficiente historial previo.
 */
export function buildRecommendation(flags: RedFlag[], context: RedFlagContext = EMPTY_CONTEXT): string {
  const hasAlta = flags.some(f => f.severity === 'alta');
  const types = new Set(flags.map(f => f.type));
  const rhSuffix = hasAlta ? ' Si lo necesitas, pide apoyo a RH.' : '';

  if (types.has('vacation') && types.size === 1) {
    return 'Está de vacaciones esta semana — no se espera respuesta durante esos días, no es necesario dar seguimiento.';
  }

  if (types.has('silence')) {
    if (context.wasActiveBeforeSilence === true) {
      return `Dejó de contestar de un día para otro después de ser constante — pregúntale directamente si algo cambió (carga de trabajo, algo personal, etc.), no asumas que es falta de interés.${rhSuffix}`;
    }
    if (context.wasActiveBeforeSilence === false) {
      return `Ya venía respondiendo poco antes de esta semana, no es algo de un solo día — más que un check-in puntual, conviene ver si el pulso le está costando trabajo o si necesita un recordatorio.${rhSuffix}`;
    }
    return `Dejó de responder el pulso varios días — confírmale que está bien y si necesita ayuda para contestar.${rhSuffix}`;
  }

  if (types.has('low_score')) {
    if (context.priorAvgScore !== null && context.priorAvgScore >= LOW_SCORE_THRESHOLD) {
      return `Su calificación bajó de golpe frente a su promedio habitual (${context.priorAvgScore}/5) — pregúntale si fue algo puntual de esta semana en vez de asumir un problema general.${rhSuffix}`;
    }
    if (context.priorAvgScore !== null && context.priorAvgScore < LOW_SCORE_THRESHOLD) {
      return `Sus calificaciones llevan tiempo bajas, no es de una sola semana — vale más una conversación a fondo sobre qué lo tiene así que un check-in rápido.${rhSuffix}`;
    }
    return `Calificó bajo esta semana — pregúntale qué fue lo que le costó trabajo.${rhSuffix}`;
  }

  if (types.has('late_morning')) {
    return context.recurringLateMorning === true
      ? 'Suele arrancar tarde el día, no es solo esta semana — vale la pena revisar si su horario de inicio le está funcionando o si necesita ajustarse.'
      : 'Empezó tarde el día esta semana — pregúntale si tuvo algún imprevisto en la mañana.';
  }

  if (types.has('missing_response')) {
    return 'Sí participa en el resto del día pero se salta un slot puntual del pulso — revisa si ese horario choca con algo fijo en su agenda.';
  }

  return hasAlta
    ? `Busca a la persona colaboradora para ver cómo está y, si lo necesitas, pide apoyo a RH.`
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
    const personRecords = byEmail.get(person.email) || [];
    const flags = computeRedFlagsForPerson(person.email, personRecords, now);
    if (flags.length === 0) continue;
    const recommendation = buildRecommendation(flags, buildFlagContext(personRecords, now));
    result.push({ email: person.email, fullName: person.fullName, team: person.team, flags, recommendation });
  }

  return result.sort((a, b) => {
    const aAlta = a.flags.some(f => f.severity === 'alta') ? 0 : 1;
    const bAlta = b.flags.some(f => f.severity === 'alta') ? 0 : 1;
    if (aAlta !== bAlta) return aAlta - bAlta;
    return b.flags.length - a.flags.length;
  });
}
