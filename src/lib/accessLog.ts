import type { ResponseRecord } from './pulseData.ts';
import { resolveOrgAccess, scopedTeamNames, allViewAsTargets } from './orgPermissions.ts';
import { rosterEmailsForTeam, rosterForTeams, fullNameFor } from './orgChart.ts';
import { filterVacationingEmails } from './vacations.ts';
import { computeKpis } from './scoring.ts';
import { computeRedFlagsForRoster } from './redFlags.ts';

/**
 * Monitoreo de accesos y brief por líder, escrito a un Google Sheet — no hay forma de escribir a
 * Sheets desde aquí de otro modo (la única conexión existente, `sheets.ts`, es de solo lectura vía
 * el CSV público del Sheet). El canal de escritura es un Web App de Google Apps Script desplegado
 * sobre el Sheet de Pulso (ver `docs/apps-script-accesos.gs`, o pídele el código a Angie): recibe
 * un POST con `{ secret, sheet: 'accesos'|'brief', rows }` y agrega filas a la pestaña
 * correspondiente. Sin `ACCESS_LOG_WEBHOOK_URL` configurado, todo esto es un no-op silencioso.
 */

export interface AccessRow {
  at: string;
  type: 'login' | 'view';
  name: string;
  email: string;
  view: string;
}

export interface LeaderBriefRow {
  at: string;
  name: string;
  email: string;
  team: string;
  bdAverage: number | null;
  btAverage: number | null;
  participationPct: number | null;
  redFlagsCount: number;
}

async function postToWebhook(sheet: 'accesos' | 'brief', rows: unknown[]): Promise<void> {
  const url = process.env.ACCESS_LOG_WEBHOOK_URL || '';
  if (!url || rows.length === 0) return;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: process.env.ACCESS_LOG_SECRET || '', sheet, rows }),
  });
  if (!res.ok) throw new Error(`El webhook de accesos respondió ${res.status}.`);
}

/** Registra un login o la apertura de una vista — nunca lanza ni bloquea a quien la llama. */
export function logAccessEvent(event: { type: 'login' | 'view'; email: string; name: string; view?: string }): void {
  const row: AccessRow = { at: new Date().toISOString(), type: event.type, name: event.name, email: event.email, view: event.view || '' };
  postToWebhook('accesos', [row]).catch(() => {});
}

/** Envía el snapshot diario del brief por líder — a diferencia de `logAccessEvent`, sí se espera (es el trabajo completo de la función programada que la llama). */
export function sendLeaderBriefRows(rows: LeaderBriefRow[]): Promise<void> {
  return postToWebhook('brief', rows);
}

/**
 * Un renglón por cada cuenta con acceso al dashboard (todo líder, más visión global y acceso
 * restringido — la misma lista que alimenta "Ver como"): su pulso de la semana en curso y cuántas
 * red flags tiene activas ahora mismo. Pensado para correr una vez al día (ver
 * `netlify/functions/leader-brief-snapshot.ts`) y así tener en el Sheet lo mismo que cualquier
 * líder vería en su dashboard (o jalaría por el conector MCP), sin que tengan que entrar.
 */
export function buildLeaderBriefRows(allRecords: ResponseRecord[], now: Date = new Date()): LeaderBriefRow[] {
  const at = now.toISOString();
  const rows: LeaderBriefRow[] = [];

  for (const target of allViewAsTargets()) {
    const access = resolveOrgAccess(target.email);
    if (!access.granted) continue;

    const teams = scopedTeamNames(access);
    const rosterEmails = new Set<string>();
    for (const team of teams) for (const email of rosterEmailsForTeam(team)) rosterEmails.add(email);
    const liveRosterEmails = new Set(filterVacationingEmails(rosterEmails, 'ALL', now));

    const records = allRecords.filter(r => liveRosterEmails.has(r.email));
    const kpis = computeKpis(records, liveRosterEmails.size);

    const roster = rosterForTeams(teams);
    const flags = computeRedFlagsForRoster(roster, allRecords, now);

    rows.push({
      at,
      name: fullNameFor(target.email) || target.label,
      email: target.email,
      team: access.primaryTeam || (access.visionGlobal ? 'Toda la tropa' : ''),
      bdAverage: kpis.bdAverage,
      btAverage: kpis.btAverage,
      participationPct: kpis.participationPct,
      redFlagsCount: flags.length,
    });
  }

  return rows;
}
