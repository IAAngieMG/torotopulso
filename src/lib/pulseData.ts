import { cell, isBlankRow } from './sheets.ts';

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
