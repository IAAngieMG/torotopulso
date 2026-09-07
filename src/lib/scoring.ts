import type { ResponseRecord } from './pulseData.ts';

const DAY_MS = 86400000;
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export interface RangeFilter {
  range: 'realtime' | 'week' | 'month';
  now?: Date;
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function inRange(record: ResponseRecord, filter: RangeFilter): boolean {
  const now = filter.now ?? new Date();
  const ts = new Date(record.timestamp);
  if (Number.isNaN(ts.getTime())) return false;
  if (filter.range === 'month') {
    return ts.getFullYear() === now.getFullYear() && ts.getMonth() === now.getMonth();
  }
  const weekStart = startOfWeek(now);
  if (filter.range === 'week') {
    return ts >= weekStart && ts.getTime() < weekStart.getTime() + 7 * DAY_MS;
  }
  // realtime: today only
  return ts.toDateString() === now.toDateString();
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

// El Sheet trae dos columnas de puntaje: `rawScore` en la escala real 1-5 de la encuesta,
// y `score` que ya viene doblado a una escala 0-10 para otros usos. El dashboard muestra
// "X/5", así que aquí siempre promediamos `rawScore`.
function scores(records: ResponseRecord[], qCode: string): number[] {
  return records.filter(r => r.qCode === qCode && r.rawScore !== null).map(r => r.rawScore as number);
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
  bdAverage: number | null;
  btAverage: number | null;
  participationPct: number | null;
  participationDetail: string;
  onTimePct: number | null;
}

export function computeKpis(records: ResponseRecord[], rosterSize: number): OverviewKpis {
  const respondents = new Set(records.map(r => r.email).filter(Boolean));
  const participationPct = rosterSize > 0 ? Math.round((respondents.size / rosterSize) * 1000) / 10 : null;
  return {
    bdAverage: average(scores(records, 'BD')),
    btAverage: average(scores(records, 'BT')),
    participationPct,
    participationDetail: `${respondents.size} de ${rosterSize} personas`,
    onTimePct: onTimeRate(records),
  };
}

export interface DailyPoint {
  day: string;
  bd: number | null;
  bt: number | null;
}

/** Mon-Fri average BD/BT for the week containing `now`. */
export function computeWeeklySeries(records: ResponseRecord[], now = new Date()): DailyPoint[] {
  const weekStart = startOfWeek(now);
  const points: DailyPoint[] = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(weekStart.getTime() + i * DAY_MS);
    const dayRecords = records.filter(r => new Date(r.timestamp).toDateString() === day.toDateString());
    points.push({
      day: DIAS[day.getDay()],
      bd: average(scores(dayRecords, 'BD')),
      bt: average(scores(dayRecords, 'BT')),
    });
  }
  return points;
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
