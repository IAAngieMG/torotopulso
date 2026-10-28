/**
 * Incidencias técnicas conocidas: encuestas que no se enviaron (o no llegaron a tiempo a nadie)
 * por una falla ajena al equipo — no deben interpretarse como que la tropa no quiso responder.
 *
 * Mientras una incidencia esté registrada aquí, su fecha+encuesta:
 *  - no cuenta como "no respondió" en red flags (`redFlags.ts`, `btMissingDays`);
 *  - si alguien sí respondió ese día (p.ej. por estar en otra zona horaria y que a esa persona sí
 *    le llegara), su respuesta sigue siendo válida y cuenta normal en todos los cálculos — esto no
 *    excluye respuestas reales, solo evita penalizar su ausencia en el resto de la tropa.
 *  - agrega una nota breve al resumen (`buildAutoInsight`/brief de Pulso) cuando el periodo
 *    analizado incluye esa fecha.
 */
export interface TechnicalIncident {
  date: string; // YYYY-MM-DD
  qCode: string; // encuesta afectada (ej. 'BT' = Cierre del día)
  note: string; // nota breve a mostrar cuando el rango analizado incluya `date`
}

export const TECHNICAL_INCIDENTS: TechnicalIncident[] = [
  {
    date: '2026-10-27',
    qCode: 'BT',
    note: 'El 27/10 el cierre del día no se envió por una falla técnica; no afecta la participación.',
  },
];

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** True si esa fecha (YYYY-MM-DD) tuvo una falla técnica conocida para esa encuesta. */
export function isIncidentDate(dateKey: string, qCode: string): boolean {
  const upper = qCode.toUpperCase();
  return TECHNICAL_INCIDENTS.some(i => i.date === dateKey && i.qCode === upper);
}

/** Notas de incidencias cuyo día cae dentro de la ventana [start, end), sin duplicados. */
export function incidentNotesForRange(start: Date, end: Date): string[] {
  const notes = TECHNICAL_INCIDENTS.filter(i => {
    const d = parseDateKey(i.date);
    return d >= start && d < end;
  }).map(i => i.note);
  return [...new Set(notes)];
}
