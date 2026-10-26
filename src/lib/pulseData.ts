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
      qCode: cell(row, 3).trim().toUpperCase(),
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

/**
 * "BD" (Inicio del día, escala 1-5) y "BUK-E" (recordatorio de check-in de entrada en Buk, un
 * botón, no una calificación) son dos encuestas distintas y concurrentes — no una versión vieja
 * y una nueva de la misma pregunta. Antes "BUK-E" se normalizaba a "BD" (ver git history), lo que
 * mezclaba sus respuestas y rompía toda detección de "cuál es cuál" río abajo (`scoring.ts`,
 * `redFlags.ts`), porque `rawScore`/`choice` se pueblan igual en ambas (mimetizan la opción
 * elegida, 1-2 en BUK-E, 1-5 en BD) y `question` nunca trae el texto completo de la escala —
 * solo el `qCode` crudo distingue una de la otra de forma confiable. "BUK-E" se incluye aquí
 * para que `isFridaySignal` no la cuente por error como encuesta de Viernes.
 */
const DAILY_SLOTS = ['BD', 'AL', 'BT', 'BUK-E'];

/**
 * Código de la encuesta especial "7 años Toroto" (aniversario), enviada una sola vez el 29 de
 * octubre de 2026 — ver `src/lib/anniversary.ts`. Va aparte de BD/AL/BT/BUK-E y de la encuesta de
 * Viernes, así que debe excluirse explícitamente de `isFridaySignal` (que de otro modo la
 * contaría como Viernes por eliminación) y del resto de los cálculos de KPIs normales.
 */
export const ANIV7_QCODE = 'ANIV7';

/**
 * `Respuestas.qCode` no usa un código "VIERNES" literal para la encuesta larga del viernes:
 * usa códigos de pregunta rotativos (Q1..Q4, uno por semana, según cuál de las 4 preguntas del
 * pool tocó esa semana). Cualquier qCode que no sea BD/AL/BT/BUK-E/ANIV7 es, por eliminación, una
 * respuesta de la encuesta de Viernes.
 */
export function isFridaySignal(qCode: string): boolean {
  const upper = qCode.toUpperCase();
  return upper !== ANIV7_QCODE && !DAILY_SLOTS.includes(upper);
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
