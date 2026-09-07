import { cell, isBlankRow } from './sheets.ts';

export interface Team {
  name: string;
  leaderName: string;
  members: string[];
}

export interface SubTeam {
  parentLabel: string;
  name: string;
  leaderName: string;
  members: string[];
}

export interface ResponseRecord {
  timestamp: string;
  responseKey: string;
  surveyName: string;
  qCode: string;
  question: string;
  respondentName: string;
  email: string;
  slackUserId: string;
  groups: string;
  roles: string;
  rawScore: number | null;
  score: number | null;
  sentiment: string;
  choice: number | null;
  scheduledDate: string;
  scheduledTime: string;
}

export interface QuestionTemplate {
  mes: string;
  slot: string;
  mensaje: string;
}

/** Forward-fills a "merged cell" style sheet: a blank leading column continues the previous row's block. */
function forwardFillBlocks(rows: string[][], keyColumns: number[]): string[][] {
  const filled: string[][] = [];
  const last: string[] = [];
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const next = [...row];
    for (const col of keyColumns) {
      if (cell(next, col) === '' && last[col]) next[col] = last[col];
      if (cell(next, col) !== '') last[col] = cell(next, col);
    }
    filled.push(next);
  }
  return filled;
}

/** Parses `Grupos`: DIRECCIÓN, PERSONA LÍDER, PERSONA COLABORADORA (block-merged). */
export function parseGrupos(rows: string[][]): Team[] {
  const body = rows.slice(1); // drop header
  const filled = forwardFillBlocks(body, [0, 1]);
  const byTeam = new Map<string, Team>();
  for (const row of filled) {
    const direccion = cell(row, 0);
    const lider = cell(row, 1);
    const colaborador = cell(row, 2);
    if (!direccion) continue;
    if (!byTeam.has(direccion)) byTeam.set(direccion, { name: direccion, leaderName: lider, members: [] });
    const team = byTeam.get(direccion)!;
    if (colaborador && colaborador !== lider) team.members.push(colaborador);
  }
  return [...byTeam.values()];
}

/** Parses `Grupos a detalles`: same block-merge shape, but the first column mixes ALL-CAPS section
 * headers (no leader/member on that row) with actual sub-team rows. */
export function parseGruposDetalle(rows: string[][]): SubTeam[] {
  const filled = forwardFillBlocks(rows, [0, 1]);
  const subTeams: SubTeam[] = [];
  let currentSection = '';
  const byName = new Map<string, SubTeam>();
  for (const row of filled) {
    const label = cell(row, 0);
    const lider = cell(row, 1);
    const colaborador = cell(row, 2);
    if (!label) continue;
    const isSectionHeader = !lider && !colaborador && label === label.toUpperCase();
    if (isSectionHeader) {
      currentSection = label;
      continue;
    }
    if (!byName.has(label)) {
      const team: SubTeam = { parentLabel: currentSection, name: label, leaderName: lider, members: [] };
      byName.set(label, team);
      subTeams.push(team);
    }
    const team = byName.get(label)!;
    if (colaborador && colaborador !== lider) team.members.push(colaborador);
  }
  return subTeams;
}

/** Parses `Filtro especial`: PERSONA (bloque) -> lista de equipos visibles. */
export function parseFiltroEspecial(rows: string[][]): Map<string, string[]> {
  const body = rows.slice(1);
  const filled = forwardFillBlocks(body, [0]);
  const map = new Map<string, string[]>();
  for (const row of filled) {
    const persona = cell(row, 0);
    const equipo = cell(row, 1);
    if (!persona || !equipo) continue;
    if (!map.has(persona)) map.set(persona, []);
    const list = map.get(persona)!;
    if (!list.includes(equipo)) list.push(equipo);
  }
  return map;
}

const GLOBAL_ACCESS_LABEL = /visi[oó]n global/i;

/** Whether a Filtro especial entry means "see literally everything" rather than a specific team list. */
export function grantsGlobalAccess(visibleTeams: string[]): boolean {
  return visibleTeams.some(t => GLOBAL_ACCESS_LABEL.test(t));
}

/** Parses `SlackID`: slackId, nombreCompleto, email, nombreDePila. */
export function parseSlackId(rows: string[][]) {
  const byName = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const firstNameByEmail = new Map<string, string>();
  for (const row of rows.slice(1)) {
    const fullName = cell(row, 1);
    const email = cell(row, 2).toLowerCase();
    const firstName = cell(row, 3);
    if (!fullName || !email) continue;
    byName.set(fullName, email);
    byEmail.set(email, fullName);
    if (firstName) firstNameByEmail.set(email, firstName);
  }
  return { byName, byEmail, firstNameByEmail };
}

const toNumberOrNull = (v: string): number | null => {
  const n = Number(v);
  return v !== '' && Number.isFinite(n) ? n : null;
};

/** Parses `Respuestas`. */
export function parseRespuestas(rows: string[][]): ResponseRecord[] {
  return rows
    .slice(1)
    .filter(row => !isBlankRow(row))
    .map(row => ({
      timestamp: cell(row, 0),
      responseKey: cell(row, 1),
      surveyName: cell(row, 2),
      qCode: cell(row, 3),
      question: cell(row, 4),
      respondentName: cell(row, 5),
      email: cell(row, 6).toLowerCase(),
      slackUserId: cell(row, 7),
      groups: cell(row, 8),
      roles: cell(row, 9),
      rawScore: toNumberOrNull(cell(row, 10)),
      score: toNumberOrNull(cell(row, 11)),
      sentiment: cell(row, 12),
      choice: toNumberOrNull(cell(row, 13)),
      scheduledDate: cell(row, 14),
      scheduledTime: cell(row, 15),
    }));
}

/** Parses `Preguntas`. */
export function parsePreguntas(rows: string[][]): QuestionTemplate[] {
  return rows
    .slice(1)
    .filter(row => !isBlankRow(row) && cell(row, 4))
    .map(row => ({ mes: cell(row, 0), slot: cell(row, 1).toUpperCase(), mensaje: cell(row, 4) }));
}

const DAILY_SLOTS = ['BD', 'AL', 'BT'];

/**
 * `Respuestas.qCode` no usa un código "VIERNES" literal para la encuesta larga del viernes:
 * usa códigos de pregunta rotativos (Q1..Q4, uno por semana, según cuál de las 4 preguntas del
 * pool tocó esa semana). Cualquier qCode que no sea BD/AL/BT es, por eliminación, una respuesta
 * de la encuesta de Viernes.
 */
export function isFridaySignal(qCode: string): boolean {
  return !DAILY_SLOTS.includes(qCode.toUpperCase());
}

const MES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function weekOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return Math.floor((days + start.getDay()) / 7);
}

/**
 * Returns the question text currently in effect for a slot (BD/AL/BT/VIERNES).
 * BD/AL/BT rotate by calendar month; VIERNES has no month and instead cycles through
 * its ~4-entry pool by ISO week number.
 */
export function currentQuestionFor(templates: QuestionTemplate[], slot: string, at = new Date()): string {
  const upperSlot = slot.toUpperCase();
  if (upperSlot === 'VIERNES') {
    const pool = templates.filter(t => t.slot === 'VIERNES' && !t.mes);
    if (pool.length === 0) return '';
    return pool[weekOfYear(at) % pool.length].mensaje;
  }
  const mes = MES_ES[at.getMonth()];
  const forMonth = templates.find(t => t.slot === upperSlot && t.mes === mes);
  return forMonth?.mensaje ?? templates.find(t => t.slot === upperSlot)?.mensaje ?? '';
}
