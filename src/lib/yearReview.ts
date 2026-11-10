import type { ResponseRecord } from './pulseData.ts';
import type { OrgTeam } from './orgChart.ts';
import { rosterEmailsForTeam, teamsLedBy } from './orgChart.ts';

/**
 * Pausa general de Pulso por vacaciones de fin de año, y lanzamiento del "Resumen del año":
 * del 28 de diciembre al 3 de enero nadie recibe encuestas ni genera red flags; el 4 de enero
 * se reanuda y, además, cada líder (y RH) ve su resumen del año recién cerrado.
 *
 * `YEAR_REVIEW_PREVIEW_EMAILS` puede entrar un día antes (27 de diciembre) a probar cómo se verá
 * el resumen para cualquier perfil usando "Ver como" — el acceso de vista previa se decide sobre
 * quién está realmente detrás de la sesión (no sobre el perfil que esté simulando), así Angie no
 * queda bloqueada por la pausa ni por el candado de fecha mientras revisa cómo lo verá cada persona.
 */
export const YEAR_REVIEW_YEAR = 2026;
export const PULSO_PAUSE_START = '2026-12-28';
export const PULSO_PAUSE_END = '2027-01-03';
export const YEAR_REVIEW_LIVE_FROM = '2027-01-04';
export const YEAR_REVIEW_PREVIEW_FROM = '2026-12-27';
export const YEAR_REVIEW_SPOTLIGHT_UNTIL = '2027-01-31';
export const YEAR_REVIEW_PREVIEW_EMAILS = ['ti@toroto.mx'];
export const YEAR_REVIEW_RH_EMAILS = ['patricia@toroto.mx', 'karla@toroto.mx', 'samantha@toroto.mx'];

const MEXICO_TZ = 'America/Mexico_City';
/** Mismo umbral que redFlags.ts: calificación baja es BT y BD (escala 1-5) por debajo de 3/5; AL nunca cuenta (son emojis, no calidad). */
const LOW_SCORE_THRESHOLD = 3;
/** Mismo corte que redFlags.ts: "Inicio del día" a tiempo es hasta las 9:30 am hora CDMX. */
const LATE_CHECKIN_MINUTE_OF_DAY = 9 * 60 + 30;

const norm = (s: string): string => s.trim().toLowerCase();

function startOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

function endOfDay(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
}

export function isPulsoPaused(at: Date = new Date()): boolean {
  return at >= startOfDay(PULSO_PAUSE_START) && at <= endOfDay(PULSO_PAUSE_END);
}

/** True si [start, end) se traslapa con la pausa general — usado por red flags para no evaluar esa semana. */
export function isPulsoPausedWindow(start: Date, end: Date): boolean {
  return start < endOfDay(PULSO_PAUSE_END) && end > startOfDay(PULSO_PAUSE_START);
}

export interface YearReviewAccess {
  unlocked: boolean;
  preview: boolean;
  canSeeLeader: boolean;
  canSeeRh: boolean;
  /** Mientras sea true, el resumen se muestra automático al entrar (no solo disponible en el menú). */
  spotlight: boolean;
}

/**
 * `sessionEmail` es quien de verdad inició sesión (decide si el candado de fecha aplica);
 * `effectiveEmail` es el perfil que se está viendo (real, o simulado con "Ver como") y decide
 * qué contenido corresponde mostrar.
 */
export function yearReviewAccess(sessionEmail: string, effectiveEmail: string, now: Date = new Date()): YearReviewAccess {
  const liveFrom = startOfDay(YEAR_REVIEW_LIVE_FROM);
  const previewFrom = startOfDay(YEAR_REVIEW_PREVIEW_FROM);
  const session = norm(sessionEmail);
  const effective = norm(effectiveEmail);

  const unlocked = now >= liveFrom || (now >= previewFrom && YEAR_REVIEW_PREVIEW_EMAILS.includes(session));
  if (!unlocked) return { unlocked: false, preview: false, canSeeLeader: false, canSeeRh: false, spotlight: false };

  return {
    unlocked: true,
    preview: now < liveFrom,
    canSeeLeader: teamsLedBy(effective).length > 0,
    canSeeRh: YEAR_REVIEW_RH_EMAILS.includes(effective),
    spotlight: now <= endOfDay(YEAR_REVIEW_SPOTLIGHT_UNTIL),
  };
}

// --- Agregación de datos del año --------------------------------------------

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function scoresFor(records: ResponseRecord[], qCode: string): number[] {
  return records.filter(r => r.qCode === qCode && r.rawScore !== null).map(r => r.rawScore as number);
}

function inYear(record: ResponseRecord, year: number): boolean {
  const d = new Date(record.timestamp);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === year;
}

function localDateKey(iso: string, tz = MEXICO_TZ): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Minutos desde medianoche hora local (ej. 9:30 am -> 570) — mismo criterio que redFlags.ts. */
function localMinuteOfDay(iso: string, tz = MEXICO_TZ): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? d.getHours());
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? d.getMinutes());
  return hour * 60 + minute;
}

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface YearMonthlyPoint {
  month: string;
  bd: number | null;
  bt: number | null;
}

export function computeMonthlySeries(records: ResponseRecord[], year: number = YEAR_REVIEW_YEAR): YearMonthlyPoint[] {
  return MESES_CORTOS.map((month, i) => {
    const monthRecords = records.filter(r => inYear(r, year) && new Date(r.timestamp).getMonth() === i);
    return { month, bd: average(scoresFor(monthRecords, 'BD')), bt: average(scoresFor(monthRecords, 'BT')) };
  });
}

export interface YearAnnualStats {
  avgScore: number | null;
  participationPct: number | null;
  bestMonth: string | null;
  bestMonthAvg: number | null;
  totalResponses: number;
  monthly: YearMonthlyPoint[];
}

/** Participación anual = promedio de la participación mensual (meses con al menos una respuesta), no solo "respondió alguna vez en el año". */
export function computeAnnualStats(records: ResponseRecord[], rosterSize: number, year: number = YEAR_REVIEW_YEAR): YearAnnualStats {
  const yearRecords = records.filter(r => inYear(r, year));
  const monthly = computeMonthlySeries(yearRecords, year);
  const avgScore = average([...scoresFor(yearRecords, 'BD'), ...scoresFor(yearRecords, 'BT')]);

  let bestMonth: string | null = null;
  let bestMonthAvg: number | null = null;
  for (const point of monthly) {
    const vals = [point.bd, point.bt].filter((v): v is number => v !== null);
    if (vals.length === 0) continue;
    const avg = average(vals) as number;
    if (bestMonthAvg === null || avg > bestMonthAvg) {
      bestMonthAvg = avg;
      bestMonth = point.month;
    }
  }

  const monthlyParticipation: number[] = [];
  if (rosterSize > 0) {
    for (let month = 0; month < 12; month++) {
      const monthRecords = yearRecords.filter(r => new Date(r.timestamp).getMonth() === month);
      if (monthRecords.length === 0) continue;
      const respondents = new Set(monthRecords.map(r => r.email).filter(Boolean));
      monthlyParticipation.push((respondents.size / rosterSize) * 100);
    }
  }
  const participationPct = monthlyParticipation.length > 0 ? Math.round(average(monthlyParticipation)! * 10) / 10 : null;

  return { avgScore, participationPct, bestMonth, bestMonthAvg, totalResponses: yearRecords.length, monthly };
}

export function groupResponsesByEmail(records: ResponseRecord[]): Map<string, ResponseRecord[]> {
  const map = new Map<string, ResponseRecord[]>();
  for (const r of records) {
    if (!map.has(r.email)) map.set(r.email, []);
    map.get(r.email)!.push(r);
  }
  return map;
}

export interface PersonAnnualFlags {
  email: string;
  fullName: string;
  team: string;
  lateMorningCount: number;
  missingCount: number;
  lowScoreCount: number;
  totalResponses: number;
  /** null = sin oportunidades notables este año. */
  note: string | null;
}

function buildPersonNote(stats: { lateMorningCount: number; missingCount: number; lowScoreCount: number }): string | null {
  const candidates = [
    { count: stats.missingCount, text: `Dejó pendiente Alimentos o Cierre del día ${stats.missingCount} veces en el año.` },
    { count: stats.lateMorningCount, text: `Respondió Inicio del día después de las 9:30 am en ${stats.lateMorningCount} ocasiones este año.` },
    { count: stats.lowScoreCount, text: `Tuvo ${stats.lowScoreCount} calificaciones por debajo de 3/5 en el año.` },
  ]
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);
  return candidates.length > 0 ? candidates[0].text : null;
}

export function computePersonAnnualFlags(
  email: string,
  fullName: string,
  team: string,
  records: ResponseRecord[],
  year: number = YEAR_REVIEW_YEAR,
): PersonAnnualFlags {
  const yearRecords = records.filter(r => inYear(r, year));
  const byDate = new Map<string, ResponseRecord[]>();
  for (const r of yearRecords) {
    const key = localDateKey(r.timestamp);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(r);
  }

  let lateMorningCount = 0;
  let missingCount = 0;
  for (const dayRecords of byDate.values()) {
    const bd = dayRecords.find(r => r.qCode === 'BD');
    if (bd && localMinuteOfDay(bd.timestamp) > LATE_CHECKIN_MINUTE_OF_DAY) lateMorningCount++;
    if (!dayRecords.some(r => r.qCode === 'AL')) missingCount++;
    if (!dayRecords.some(r => r.qCode === 'BT')) missingCount++;
  }

  // AL se responde con emojis, no con calificación de calidad — igual que en redFlags.ts, nunca cuenta aquí.
  const lowScoreCount = yearRecords.filter(
    r => (r.qCode === 'BD' || r.qCode === 'BT') && r.rawScore !== null && (r.rawScore as number) < LOW_SCORE_THRESHOLD,
  ).length;

  return {
    email,
    fullName,
    team,
    lateMorningCount,
    missingCount,
    lowScoreCount,
    totalResponses: yearRecords.length,
    note: buildPersonNote({ lateMorningCount, missingCount, lowScoreCount }),
  };
}

export interface RosterPersonLike {
  email: string;
  fullName: string;
  team: string;
}

export interface PersonOpportunity {
  email: string;
  fullName: string;
  team: string;
  note: string;
}

export interface PersonHighlight {
  email: string;
  fullName: string;
  team: string;
}

/** Hasta 4 personas con más oportunidades (ordenadas por volumen de incidencias) y hasta 2 destacadas sin ninguna. */
export function rankPersonOpportunities(
  roster: RosterPersonLike[],
  byEmail: Map<string, ResponseRecord[]>,
  year: number = YEAR_REVIEW_YEAR,
): { opportunities: PersonOpportunity[]; highlights: PersonHighlight[] } {
  const flagsList = roster.map(p => computePersonAnnualFlags(p.email, p.fullName, p.team, byEmail.get(p.email) || [], year));

  const opportunities = flagsList
    .filter(f => f.note !== null)
    .sort((a, b) => b.lateMorningCount + b.missingCount + b.lowScoreCount - (a.lateMorningCount + a.missingCount + a.lowScoreCount))
    .slice(0, 4)
    .map(f => ({ email: f.email, fullName: f.fullName, team: f.team, note: f.note as string }));

  const highlights = flagsList
    .filter(f => f.note === null && f.totalResponses > 0)
    .sort((a, b) => b.totalResponses - a.totalResponses)
    .slice(0, 2)
    .map(f => ({ email: f.email, fullName: f.fullName, team: f.team }));

  return { opportunities, highlights };
}

export interface TeamOpportunity {
  team: string;
  leader: string;
  leaderEmail: string;
  avgScore: number | null;
  participationPct: number | null;
  status: 'good' | 'warn';
  note: string;
}

function buildTeamNote(stats: { missing: number; late: number; low: number; participationPct: number | null; avgScore: number | null }): string {
  if (stats.avgScore === null) return 'Sin respuestas suficientes este año para evaluarlo.';
  const candidates = [
    { count: stats.participationPct !== null && stats.participationPct < 80 ? 80 - stats.participationPct : 0, text: `La participación del equipo promedió ${stats.participationPct}% en el año.` },
    { count: stats.missing, text: `El equipo dejó pendiente Alimentos o Cierre del día ${stats.missing} veces en el año.` },
    { count: stats.late, text: `El inicio del día llegó después de las 9:30 am ${stats.late} veces en el año.` },
    { count: stats.low, text: `Hubo ${stats.low} calificaciones por debajo de 3/5 en el equipo este año.` },
  ]
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count);
  return candidates.length > 0 ? candidates[0].text : 'Equipo sólido todo el año, sin oportunidades grandes que resolver.';
}

export function computeTeamOpportunity(team: OrgTeam, byEmail: Map<string, ResponseRecord[]>, year: number = YEAR_REVIEW_YEAR): TeamOpportunity {
  const emails = rosterEmailsForTeam(team.name);
  const records = emails.flatMap(e => byEmail.get(e) || []);
  const stats = computeAnnualStats(records, emails.length, year);

  let missing = 0;
  let late = 0;
  let low = 0;
  for (const email of emails) {
    const flags = computePersonAnnualFlags(email, '', team.name, byEmail.get(email) || [], year);
    missing += flags.missingCount;
    late += flags.lateMorningCount;
    low += flags.lowScoreCount;
  }

  const status: 'good' | 'warn' =
    stats.avgScore !== null && stats.avgScore >= 4.2 && (stats.participationPct === null || stats.participationPct >= 80) ? 'good' : 'warn';

  return {
    team: team.name,
    leader: team.leader.name,
    leaderEmail: team.leader.email || '',
    avgScore: stats.avgScore,
    participationPct: stats.participationPct,
    status,
    note: buildTeamNote({ missing, late, low, participationPct: stats.participationPct, avgScore: stats.avgScore }),
  };
}

export interface Wish {
  month: string;
  text: string;
}

const EVERGREEN_WISHES = [
  'Cerrar cada semana sin pendientes de Pulso.',
  'Reconocer a los equipos que mantengan su racha sin red flags.',
  'Que cada encuesta de Alimentos refleje cómo se siente la tropa.',
  'Acompañar a quien lo necesite antes de que se convierta en una red flag.',
  'Celebrar a los equipos que suban su participación mes a mes.',
  'Que las pausas de vacaciones lleguen siempre con el trabajo en orden.',
];

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** 12 deseos para el año nuevo, uno por mes: primero las oportunidades reales de este año, y de relleno los evergreen. */
export function buildWishes(teamOpportunities: TeamOpportunity[]): Wish[] {
  const fromTeams = teamOpportunities
    .filter(t => t.status === 'warn')
    .sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0))
    .map(t => `Que ${t.team} resuelva: ${t.note}`);
  const pool = fromTeams.length > 0 ? [...fromTeams, ...EVERGREEN_WISHES] : EVERGREEN_WISHES;
  return MESES.map((month, i) => ({ month, text: pool[i % pool.length] }));
}
