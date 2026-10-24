import type { ResponseRecord } from './pulseData.ts';
import { ANIV7_QCODE } from './pulseData.ts';
import type { RosterEntry } from './orgChart.ts';
import { isExcludedFromSignal } from './vacations.ts';

/**
 * Encuesta especial "7 años Toroto" (aniversario), enviada una sola vez el jueves 29 de octubre
 * de 2026 a las 9:15 am hora CDMX, con la pregunta "¿Cómo te sientes de formar parte de la
 * Tropa?" y 4 opciones fijas. Va separada de las métricas normales (no se mezcla con los KPIs
 * semanales) — las respuestas llegan al Sheet con `qCode` "ANIV7" y se excluyen de los cálculos
 * normales desde `server.ts` (ver `loadPulseData`) y de `isFridaySignal` (ver pulseData.ts).
 *
 * El envío en sí (el mensaje de Slack/Buk del jueves 29) lo dispara un sistema externo a este
 * repo (el mismo que ya llena la hoja `Respuestas`) — aquí solo se modela qué pasa con esas
 * respuestas una vez que llegan: a quién se le debía esperar respuesta (excluyendo a quien
 * estaba en "off" ese día) y la tarjeta del dashboard.
 */

/** Momento en que Pulso envió el mensaje especial — 29 de octubre de 2026, 9:15 am hora CDMX (UTC-6, sin horario de verano). */
export const ANNIVERSARY_SENT_AT = new Date('2026-10-29T15:15:00.000Z');

/** La tarjeta "7 años Toroto" solo se muestra del lunes 2 al domingo 8 de noviembre de 2026, inclusive. */
const CARD_VISIBLE_FROM = new Date('2026-11-02T00:00:00-06:00');
const CARD_VISIBLE_UNTIL = new Date('2026-11-08T23:59:59.999-06:00');

export function isAnniversaryCardVisible(now = new Date()): boolean {
  return now >= CARD_VISIBLE_FROM && now <= CARD_VISIBLE_UNTIL;
}

export interface AnniversaryOption {
  choice: number;
  emoji: string;
  label: string;
}

/** Las 4 opciones fijas de la encuesta, en el orden en que se enviaron (choice 1-4). */
export const ANNIVERSARY_OPTIONS: AnniversaryOption[] = [
  { choice: 1, emoji: '🥰', label: 'Orgullosx' },
  { choice: 2, emoji: '🌱', label: 'Creciendo con Toroto' },
  { choice: 3, emoji: '🤝', label: 'Como en casa' },
  { choice: 4, emoji: '😊', label: 'Contentx' },
];

function optionLabel(choice: number): string {
  const opt = ANNIVERSARY_OPTIONS.find(o => o.choice === choice);
  return opt ? `${opt.emoji} ${opt.label}` : `Opción ${choice}`;
}

export interface AnniversaryDistributionEntry {
  choice: number;
  emoji: string;
  label: string;
  count: number;
  pct: number;
}

export interface AnniversaryRespondent {
  email: string;
  fullName: string;
  choiceLabel: string;
}

export interface AnniversaryTeamSummary {
  team: string;
  /** Personas del equipo a quienes sí se les debía esperar respuesta (excluye a quien estaba en "off" el 29 de octubre). */
  total: number;
  answered: number;
  distribution: AnniversaryDistributionEntry[];
  respondents: AnniversaryRespondent[];
}

/**
 * Resumen de la encuesta de aniversario para un equipo puntual: cuántos contestaron de cuántos
 * se esperaba (sin contar a quien estaba en "off" el día del envío), la distribución de
 * respuestas por opción, y quiénes contestaron. `roster` debe ser solo la gente de ese equipo.
 */
export function computeAnniversarySummaryForTeam(team: string, roster: RosterEntry[], records: ResponseRecord[]): AnniversaryTeamSummary {
  const expected = roster.filter(p => !isExcludedFromSignal(p.email, ANIV7_QCODE, ANNIVERSARY_SENT_AT));
  const expectedEmails = new Set(expected.map(p => p.email));

  const byEmail = new Map<string, ResponseRecord>();
  for (const r of records) {
    if (r.qCode !== ANIV7_QCODE || !expectedEmails.has(r.email)) continue;
    if (!byEmail.has(r.email)) byEmail.set(r.email, r);
  }

  const counts = new Map<number, number>();
  const respondents: AnniversaryRespondent[] = [];
  for (const person of expected) {
    const response = byEmail.get(person.email);
    if (!response || response.choice === null) continue;
    counts.set(response.choice, (counts.get(response.choice) ?? 0) + 1);
    respondents.push({ email: person.email, fullName: person.fullName, choiceLabel: optionLabel(response.choice) });
  }

  const answered = respondents.length;
  const distribution: AnniversaryDistributionEntry[] = ANNIVERSARY_OPTIONS.map(opt => ({
    choice: opt.choice,
    emoji: opt.emoji,
    label: opt.label,
    count: counts.get(opt.choice) ?? 0,
    pct: answered > 0 ? Math.round(((counts.get(opt.choice) ?? 0) / answered) * 1000) / 10 : 0,
  }));

  return { team, total: expected.length, answered, distribution, respondents };
}

/** Igual que `computeAnniversarySummaryForTeam`, pero por cada equipo representado en el roster. */
export function computeAnniversarySummaryByTeam(roster: RosterEntry[], records: ResponseRecord[]): AnniversaryTeamSummary[] {
  const teams = [...new Set(roster.map(p => p.team))];
  return teams.map(team => computeAnniversarySummaryForTeam(team, roster.filter(p => p.team === team), records));
}
