import { isFridaySignal, isLegacyBdCheckin, type ResponseRecord } from './pulseData.ts';

const DAY_MS = 86400000;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export type RangeOption = 'realtime' | 'week' | 'lastWeek' | 'month' | 'quarter' | 'semester' | 'year';

export interface RangeFilter {
  range: RangeOption;
  now?: Date;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** [start, end) window in local time for a given range option, anchored at `now`. */
export function rangeWindow(range: RangeOption, now = new Date()): { start: Date; end: Date } {
  switch (range) {
    case 'realtime': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: new Date(start.getTime() + DAY_MS) };
    }
    case 'week': {
      const start = startOfWeek(now);
      return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
    }
    case 'lastWeek': {
      const start = new Date(startOfWeek(now).getTime() - 7 * DAY_MS);
      return { start, end: new Date(start.getTime() + 7 * DAY_MS) };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
    }
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), q * 3, 1);
      return { start, end: new Date(now.getFullYear(), q * 3 + 3, 1) };
    }
    case 'semester': {
      const half = now.getMonth() < 6 ? 0 : 6;
      const start = new Date(now.getFullYear(), half, 1);
      return { start, end: new Date(now.getFullYear(), half + 6, 1) };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: new Date(now.getFullYear() + 1, 0, 1) };
    }
  }
}

export function inRange(record: ResponseRecord, filter: RangeFilter): boolean {
  const now = filter.now ?? new Date();
  const ts = new Date(record.timestamp);
  if (Number.isNaN(ts.getTime())) return false;
  const { start, end } = rangeWindow(filter.range, now);
  return ts >= start && ts < end;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

// El Sheet trae dos columnas de puntaje: `rawScore` en la escala real 1-5 de la encuesta,
// y `score` que ya viene doblado a una escala 0-10 para otros usos. El dashboard muestra
// "X/5", así que aquí siempre promediamos `rawScore`.
//
// El check-in viejo de botones de "Inicio del día" se excluye vía `isLegacyBdCheckin` (ver
// pulseData.ts): ni `rawScore` ni `choice` poblados son, por sí solos, una señal confiable de
// formato viejo en el Sheet real — ambos también aparecen en la pregunta nueva de escala 1-5
// (ver bugs reportados 2026-10-19 y 2026-10-26).
function scores(records: ResponseRecord[], qCode: string): number[] {
  return records.filter(r => r.qCode === qCode && r.rawScore !== null && !isLegacyBdCheckin(r)).map(r => r.rawScore as number);
}

/** Fecha local (YYYY-MM-DD) de un timestamp, sin pasar por UTC para no recorrer un día. */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A response counts "on time" when it landed the same calendar day it was scheduled for.
 * `scheduledDate` llega como fecha pelona "YYYY-MM-DD" (sin hora ni zona) — comparamos texto
 * contra texto en vez de construir un `Date` a partir de esa cadena, porque `new Date('2026-08-31')`
 * se interpreta en UTC medianoche y al pasarlo a fecha local puede recorrerse un día entero.
 */
function onTimeRate(records: ResponseRecord[]): number | null {
  const withSchedule = records.filter(r => r.scheduledDate);
  if (withSchedule.length === 0) return null;
  const onTime = withSchedule.filter(r => {
    const actual = new Date(r.timestamp);
    return !Number.isNaN(actual.getTime()) && r.scheduledDate === localDateKey(actual);
  });
  return Math.round((onTime.length / withSchedule.length) * 1000) / 10;
}

export interface OverviewKpis {
  /** Promedio 1-5 de "Inicio del día" — `null` si en el rango solo hay respuestas del check-in
   * viejo por botones (ver `bdOnTimePct`) o no hubo respuestas. Desde que la pregunta de Inicio
   * del día pasó a la misma escala 1-5 que Cierre del día (oct 2026), sí es una calificación real
   * de ánimo, no solo puntualidad — ver `moodAverage`. El check-in viejo se identifica vía
   * `isLegacyBdCheckin` (pulseData.ts) — ni `choice` ni `rawScore` poblados son por sí solos una
   * señal confiable, ambos pueden venir poblados también en la pregunta nueva. */
  bdAverage: number | null;
  btAverage: number | null;
  /** Promedio combinado de las dos preguntas que miden ánimo con escala 1-5 (Inicio y Cierre del
   * día) — las dos "la misma medida", por eso se promedian juntas en vez de preferir una sola.
   * El check-in viejo por botones de Inicio del día (`isLegacyBdCheckin`) nunca entra aquí. `null`
   * si ninguna de las dos tiene respuestas calificadas en el rango. */
  moodAverage: number | null;
  /** Promedio de respuestas con calificación en el rango (incluye Inicio del día ya que ahora es
   * una calificación real, salvo cuando viene por el check-in viejo de botones —
   * `isLegacyBdCheckin` — que queda fuera). */
  overallAverage: number | null;
  participationPct: number | null;
  participationDetail: string;
  onTimePct: number | null;
  /** % de respuestas de "Inicio del día" POR EL CHECK-IN VIEJO de botones que llegaron a tiempo
   * (9:00-9:30 am CDMX) — `null` si no hubo respuestas BD de ese formato viejo en el rango. Solo
   * aplica a datos históricos anteriores al cambio a escala 1-5 (ver `bdAverage`). */
  bdOnTimePct: number | null;
  /** Reparto de los dos botones del check-in viejo ("Ya registré mi entrada" / "La registro ahora,
   * por la tarde"), ej. "3 registraron su entrada · 1 avisó que la registraría después" — `null`
   * junto con `bdOnTimePct`. Siempre en pasado (es el resultado ya dado, no necesariamente "ahora"). */
  bdOnTimeDetail: string | null;
}

/** Filtra por señal (BD/AL/BT/VIERNES) o regresa todo si la señal es 'ALL'/vacía. */
export function applySignalFilter(records: ResponseRecord[], signal: string): ResponseRecord[] {
  const upper = (signal || '').toUpperCase();
  if (!upper || upper === 'ALL') return records;
  return upper === 'VIERNES' ? records.filter(r => isFridaySignal(r.qCode)) : records.filter(r => r.qCode === upper);
}

/**
 * KPIs de una sola persona para el rango y la señal seleccionados en la UI (no un rango fijo):
 * usada tanto para su propia página de detalle como para su tarjeta dentro del detalle de
 * equipo, para que ambas vistas siempre coincidan con lo que el usuario tiene filtrado.
 */
export function kpisForPersonInRange(
  allRecords: ResponseRecord[],
  email: string,
  filter: RangeFilter,
  signal = 'ALL',
): OverviewKpis {
  const personRecords = applySignalFilter(
    allRecords.filter(r => r.email === email && inRange(r, filter)),
    signal,
  );
  return computeKpis(personRecords, 1);
}

export function computeKpis(records: ResponseRecord[], rosterSize: number): OverviewKpis {
  const respondents = new Set(records.map(r => r.email).filter(Boolean));
  const participationPct = rosterSize > 0 ? Math.round((respondents.size / rosterSize) * 1000) / 10 : null;
  const entrada = computeEntradaInsight(records);
  return {
    bdAverage: average(scores(records, 'BD')),
    btAverage: average(scores(records, 'BT')),
    moodAverage: average([...scores(records, 'BD'), ...scores(records, 'BT')]),
    overallAverage: average(
      records.filter(r => r.rawScore !== null && !isLegacyBdCheckin(r)).map(r => r.rawScore as number),
    ),
    participationPct,
    participationDetail: `${respondents.size} de ${rosterSize} personas`,
    onTimePct: onTimeRate(records),
    bdOnTimePct: entrada?.onTimePct ?? null,
    // Siempre en pasado ("registraron"/"avisaron", nunca "ya" ni futuro "lo harán"): esta tarjeta
    // reporta respuestas ya dadas, y el rango puede ser una semana pasada, no necesariamente "ahora".
    bdOnTimeDetail: entrada ? `${entrada.yaRegistreCount} registraron su entrada · ${entrada.laRegistroAhoraCount} avisaron que la registrarían después` : null,
  };
}

export interface DailyPoint {
  day: string;
  /** Promedio 1-5 de "Inicio del día" ese día/semana — `null` si solo hubo respuestas del check-in
   * viejo por botones (ver `bdOnTimePct`) o no hubo respuestas. */
  bd: number | null;
  bt: number | null;
  /** % de respuestas de "Inicio del día" POR EL CHECK-IN VIEJO de botones que llegaron a tiempo
   * (9:00-9:30 am CDMX) — `null` si ese día/semana no hubo respuestas BD de ese formato viejo. */
  bdOnTimePct: number | null;
}

/**
 * Serie diaria Lunes-Viernes. Para 'week'/'lastWeek' son 5 puntos (esa semana exacta); para
 * rangos más largos (mes, trimestre, semestre, año) se agrupa por semana en vez de por día,
 * porque graficar cada día individual de un año sería ilegible.
 */
export function computeWeeklySeries(records: ResponseRecord[], now = new Date(), range: RangeOption = 'week'): DailyPoint[] {
  if (range === 'week' || range === 'lastWeek' || range === 'realtime') {
    const anchor = range === 'lastWeek' ? new Date(now.getTime() - 7 * DAY_MS) : now;
    const weekStart = startOfWeek(anchor);
    const points: DailyPoint[] = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(weekStart.getTime() + i * DAY_MS);
      const dayRecords = records.filter(r => new Date(r.timestamp).toDateString() === day.toDateString());
      points.push({
        day: DIAS[day.getDay()],
        bd: average(scores(dayRecords, 'BD')),
        bt: average(scores(dayRecords, 'BT')),
        bdOnTimePct: computeEntradaInsight(dayRecords)?.onTimePct ?? null,
      });
    }
    return points;
  }

  // Agrupar por semana ISO-ish (lunes de esa semana) dentro de la ventana del rango.
  const { start, end } = rangeWindow(range, now);
  const buckets = new Map<number, ResponseRecord[]>();
  for (const r of records) {
    const ts = new Date(r.timestamp);
    if (Number.isNaN(ts.getTime()) || ts < start || ts >= end) continue;
    const key = startOfWeek(ts).getTime();
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekStartMs, weekRecords]) => ({
      day: new Date(weekStartMs).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
      bd: average(scores(weekRecords, 'BD')),
      bt: average(scores(weekRecords, 'BT')),
      bdOnTimePct: computeEntradaInsight(weekRecords)?.onTimePct ?? null,
    }));
}

/**
 * Buckets AL (emoji/energy) choices into a 3-way "how is the team feeling" split.
 * Assumes the 1-5 emoji scale runs low-energy -> high-energy; not a literal Sheet field.
 */
export interface EnergyDistribution {
  altaEnergiaPct: number;
  enfoquePct: number;
  pausaPct: number;
}

export interface AutoInsight {
  headline: string;
  bullets: string[];
  recommendation: string | null;
}

const MEXICO_TZ = 'America/Mexico_City';
/** Ventana de "entrada a tiempo": de 9:00 a 9:30 am hora CDMX. */
const ENTRADA_WINDOW_START_MIN = 9 * 60;
const ENTRADA_WINDOW_END_MIN = 9 * 60 + 30;
/** `choice` que corresponde a cada botón del check-in de entrada, en el orden en que aparecen. */
const ENTRADA_CHOICE_YA_REGISTRE = 1;
const ENTRADA_CHOICE_LA_REGISTRO_AHORA = 2;

function localMinutesOfDay(iso: string, tz = MEXICO_TZ): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? d.getHours());
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? d.getMinutes());
  return hour * 60 + minute;
}

/**
 * Lectura del check-in de entrada (slot BD) cuando viene por botones ("Ya registré mi entrada" /
 * "La registro ahora, por la tarde") en vez de una calificación 1-5 — se detecta vía
 * `isLegacyBdCheckin` (pulseData.ts), que usa el texto real de la pregunta enviada cuando está
 * disponible, en vez de `choice`/`rawScore` solos (ambos pueden venir poblados también en la
 * pregunta nueva — ver bugs reportados 2026-10-19 y 2026-10-26). `null` si esta semana el BD no
 * es de este formato.
 */
export interface EntradaInsight {
  onTimePct: number; // % de respuestas BD entre 9:00 y 9:30 am hora CDMX
  yaRegistreCount: number;
  laRegistroAhoraCount: number;
  total: number;
}

export function computeEntradaInsight(records: ResponseRecord[]): EntradaInsight | null {
  const entradas = records.filter(r => isLegacyBdCheckin(r));
  if (entradas.length === 0) return null;
  const onTime = entradas.filter(r => {
    const mins = localMinutesOfDay(r.timestamp);
    return mins >= ENTRADA_WINDOW_START_MIN && mins <= ENTRADA_WINDOW_END_MIN;
  });
  return {
    onTimePct: Math.round((onTime.length / entradas.length) * 1000) / 10,
    yaRegistreCount: entradas.filter(r => r.choice === ENTRADA_CHOICE_YA_REGISTRE).length,
    laRegistroAhoraCount: entradas.filter(r => r.choice === ENTRADA_CHOICE_LA_REGISTRO_AHORA).length,
    total: entradas.length,
  };
}

export interface ChoiceBreakdown {
  choice: number;
  count: number;
  pct: number;
}

/** Reparto de respuestas de opción múltiple (`choice`) para un qCode, de mayor a menor frecuencia. */
export function computeChoiceBreakdown(records: ResponseRecord[], qCode: string): ChoiceBreakdown[] {
  const matching = records.filter(r => r.qCode === qCode && r.choice !== null);
  if (matching.length === 0) return [];
  const counts = new Map<number, number>();
  for (const r of matching) counts.set(r.choice as number, (counts.get(r.choice as number) ?? 0) + 1);
  return [...counts.entries()]
    .map(([choice, count]) => ({ choice, count, pct: Math.round((count / matching.length) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Resumen automático estilo "Pulso IA" del mockup, pero calculado con reglas simples sobre
 * los números ya obtenidos (no una llamada a un LLM) — evita el costo/latencia de una API de
 * IA para un texto que de todas formas viene de datos determinísticos.
 *
 * `records` es el mismo conjunto ya filtrado por rango/señal que produjo `kpis`/`weeklySeries`;
 * se usa aquí solo para las señales de opción múltiple (entrada a tiempo, comida) que no caben en
 * `OverviewKpis`.
 */
export function buildAutoInsight(
  kpis: OverviewKpis,
  weeklySeries: DailyPoint[],
  scopeLabel: string,
  records: ResponseRecord[] = [],
  isPerson = false,
): AutoInsight {
  const entrada = computeEntradaInsight(records);
  const lunch = computeChoiceBreakdown(records, 'AL');

  if (kpis.moodAverage === null && entrada === null && lunch.length === 0) {
    return { headline: `Todavía no hay respuestas registradas para ${scopeLabel} en este rango.`, bullets: [], recommendation: null };
  }

  const withMood = weeklySeries.filter(p => p.bt !== null || p.bd !== null);
  const dayMood = (p: DailyPoint) => (p.bt !== null && p.bd !== null ? (p.bt + p.bd) / 2 : (p.bt ?? p.bd ?? 5));
  const worstMoodDay = withMood.length ? withMood.reduce((a, b) => (dayMood(b) < dayMood(a) ? b : a)) : null;

  // Lo único que refleja cómo se sintió la persona/equipo es una calificación 1-5: "Cierre del
  // día" (BT) y, desde que pasó a la misma escala (oct 2026), "Inicio del día" (BD) también —
  // "Alimentos" (participación) sigue siendo un indicador aparte que nunca mueve la calificación
  // general. El check-in viejo de botones (sin `rawScore`) no cuenta aquí (ver `bdOnTimePct`).
  const climate =
    kpis.moodAverage == null ? null : kpis.moodAverage >= 4 ? 'estable y positivo' : kpis.moodAverage >= 3 ? 'estable' : 'con oportunidad de mejora';
  const capitalizedScope = scopeLabel.charAt(0).toUpperCase() + scopeLabel.slice(1);
  const headline = climate
    ? `${capitalizedScope} se mantiene ${climate} en este rango.`
    : `${capitalizedScope} no tiene calificación de ánimo registrada en este rango.`;

  const bullets: string[] = [];
  if (entrada) {
    // Solo se menciona lo que sí pasó: si el 100% registró a tiempo, decir además "0 avisaron
    // que la registrarían después" no aporta nada (es obvio) — esa cláusula solo suma cuando
    // hay un reparto real entre los dos botones.
    const aviso = entrada.laRegistroAhoraCount > 0 ? `; ${entrada.laRegistroAhoraCount} de ${entrada.total} avisó que la registraría más tarde` : '';
    bullets.push(`**${entrada.onTimePct}%** registró su entrada a tiempo (9:00–9:30 am)${aviso}.`);
  }
  if (lunch.length > 0) {
    const top = lunch[0];
    bullets.push(`La opción de comida más elegida fue la opción **#${top.choice}** (${top.pct}% de las respuestas).`);
  }
  if (kpis.bdAverage !== null) bullets.push(`El inicio del día promedió **${kpis.bdAverage.toFixed(1)}/5**.`);
  if (kpis.btAverage !== null) bullets.push(`El cierre del día promedió **${kpis.btAverage.toFixed(1)}/5**.`);
  // La participación (cuántos de cuántos respondieron) solo aporta en equipo/general — en el
  // resumen de una sola persona es obvio (siempre "1 de 1") y no debe salir.
  if (!isPerson && kpis.participationPct !== null) {
    bullets.push(
      kpis.participationPct >= 90
        ? `Participación alta: **${kpis.participationPct}%** (${kpis.participationDetail}).`
        : `Participación de **${kpis.participationPct}%** (${kpis.participationDetail}).`,
    );
  }

  let recommendation: string | null = null;
  if (worstMoodDay && dayMood(worstMoodDay) < 3.5) {
    recommendation = `Revisar qué ocurrió el ${worstMoodDay.day.toLowerCase()}, cuando el ánimo bajó a ${dayMood(worstMoodDay).toFixed(1)}/5.`;
  } else if (entrada && entrada.onTimePct < 70) {
    recommendation = `Solo ${entrada.onTimePct}% registró su entrada entre 9:00 y 9:30 am — vale la pena recordar el horario.`;
  } else if (kpis.onTimePct !== null && kpis.onTimePct < 70) {
    recommendation = `Solo ${kpis.onTimePct}% de las respuestas llegaron a tiempo — vale la pena recordar el horario en el standup.`;
  } else if (kpis.participationPct !== null && kpis.participationPct < 80) {
    recommendation = `La participación de ${kpis.participationPct}% tiene margen para subir — vale la pena dar seguimiento con quienes no han respondido.`;
  }

  return { headline, bullets, recommendation };
}

export function computeEnergyDistribution(records: ResponseRecord[]): EnergyDistribution | null {
  const al = records.filter(r => r.qCode === 'AL' && r.choice !== null);
  if (al.length === 0) return null;
  const alta = al.filter(r => (r.choice as number) >= 4).length;
  const pausa = al.filter(r => (r.choice as number) <= 2).length;
  const enfoque = al.length - alta - pausa;
  return {
    altaEnergiaPct: Math.round((alta / al.length) * 1000) / 10,
    enfoquePct: Math.round((enfoque / al.length) * 1000) / 10,
    pausaPct: Math.round((pausa / al.length) * 1000) / 10,
  };
}
