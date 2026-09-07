import { cell, isBlankRow } from './sheets.ts';

export interface Nomination {
  id: string;
  submittedAt: string;
  month: string;
  slackId: string;
  nominatorName: string;
  nominatorEmail: string;
  rawText: string;
}

/**
 * Parses the "Repositorio Reconocimientos" -> "Respuestas" sheet: one row per free-text
 * nomination submitted through the Slack bot. Filters out the template's own "EJEMPLO-001"
 * placeholder row and any trailing blank padding rows.
 */
export function parseNominations(rows: string[][]): Nomination[] {
  return rows
    .slice(1)
    .filter(row => !isBlankRow(row))
    .map(row => ({
      id: cell(row, 0),
      submittedAt: cell(row, 1),
      month: cell(row, 2),
      slackId: cell(row, 3),
      nominatorName: cell(row, 4),
      nominatorEmail: cell(row, 5).toLowerCase(),
      rawText: cell(row, 6),
    }))
    .filter(n => n.id && !n.id.toUpperCase().startsWith('EJEMPLO'));
}
