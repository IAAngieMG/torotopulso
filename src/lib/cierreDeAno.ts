import type { ResponseRecord } from './pulseData.ts';
import { CIERRE_DE_ANO_QCODES, FIESTAS_QCODE } from './pulseData.ts';

/**
 * Agregación de la encuesta especial "Cierre de año" (CA1-3, los tres viernes de diciembre de
 * 2026) y de "Fiestas" (22 de diciembre) — van siempre aparte de Q1-Q4 y de los KPIs normales de
 * ánimo (ver `pulseData.ts`), nunca mezcladas con ellos.
 */

const CIERRE_DE_ANO_QUESTIONS: Record<string, { date: string; label: string }> = {
  CA1: { date: '2026-12-04', label: '¿Cómo calificarías tu año en Toroto?' },
  CA2: { date: '2026-12-11', label: '¿Sientes que tu trabajo fue reconocido?' },
  CA3: { date: '2026-12-18', label: '¿Con qué ánimo te imaginas el 2027?' },
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

export interface CierreDeAnoQuestionStats {
  qCode: string;
  date: string;
  label: string;
  average: number | null;
  totalResponses: number;
}

/** Promedio (1-5) de cada pregunta de Cierre de año, cada una por separado — nunca junto con Q1-Q4 ni con BD/BT. */
export function computeCierreDeAnoStats(records: ResponseRecord[]): CierreDeAnoQuestionStats[] {
  return CIERRE_DE_ANO_QCODES.map(qCode => {
    const matching = records.filter(r => r.qCode === qCode && r.rawScore !== null);
    const meta = CIERRE_DE_ANO_QUESTIONS[qCode];
    return {
      qCode,
      date: meta?.date ?? '',
      label: meta?.label ?? qCode,
      average: average(matching.map(r => r.rawScore as number)),
      totalResponses: matching.length,
    };
  });
}

export interface FiestasOption {
  choice: number;
  label: string;
}

/**
 * Orden/numeración asumida igual al orden en que Angie las describió (no confirmado contra el
 * Sheet real todavía): 1=en casa con la familia, 2=de viaje, 3=con amigos, 4=descansando en
 * pijama, 5=comiendo de todo. Ajustar aquí si el `choice` real del Sheet viene en otro orden.
 */
export const FIESTAS_OPTIONS: FiestasOption[] = [
  { choice: 1, label: 'En casa con la familia' },
  { choice: 2, label: 'De viaje' },
  { choice: 3, label: 'Con amigos' },
  { choice: 4, label: 'Descansando en pijama' },
  { choice: 5, label: 'Comiendo de todo' },
];

export interface FiestasBreakdownEntry {
  choice: number;
  label: string;
  count: number;
  pct: number;
}

/** % de personas que eligió cada opción de "cómo vas a celebrar" — dato bonito de cierre de año, nunca una calificación de ánimo. */
export function computeFiestasBreakdown(records: ResponseRecord[]): FiestasBreakdownEntry[] {
  const matching = records.filter(r => r.qCode === FIESTAS_QCODE && r.choice !== null);
  const total = matching.length;
  const counts = new Map<number, number>();
  for (const r of matching) counts.set(r.choice as number, (counts.get(r.choice as number) ?? 0) + 1);
  return FIESTAS_OPTIONS.map(opt => ({
    choice: opt.choice,
    label: opt.label,
    count: counts.get(opt.choice) ?? 0,
    pct: total > 0 ? Math.round(((counts.get(opt.choice) ?? 0) / total) * 1000) / 10 : 0,
  }));
}
