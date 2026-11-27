/**
 * Excepciones de calendario de Pulso para fin de 2026 / inicio de 2027, confirmadas por Angie —
 * para que red flags, recordatorios y el resumen anual no interpreten estos días como silencio,
 * datos faltantes o una alerta real. Distinto de `incidents.ts` (fallas técnicas no planeadas):
 * aquí nadie recibió nada, o recibió algo distinto, porque así estaba diseñado.
 *
 * La pausa general de fin de año (23 dic - 3 ene) vive aparte, en `yearReview.ts`
 * (`isPulsoPausedWindow`) — ya la consultan red flags y no se repite aquí.
 */

/** Feriados puntuales en los que Pulso no envía absolutamente nada (ni BD/AL/BT ni Viernes). */
const HOLIDAY_NO_SURVEY_DATES = ['2026-11-16']; // Día de la Revolución Mexicana (observado, 3er lunes de noviembre).

/**
 * El tercer viernes de cada mes normalmente no tiene la encuesta rotativa de Viernes (Q1-Q4) —
 * regla recurrente, no solo de este año. `VIERNES_SURVEY_OVERRIDES` son fechas puntuales en las
 * que, pese a ser tercer viernes, sí hubo encuesta: el 18 de diciembre de 2026 tuvo CA3 (parte
 * del "Cierre de año", ver `pulseData.ts` y `cierreDeAno.ts`).
 */
const VIERNES_SURVEY_OVERRIDES = ['2026-12-18'];

/**
 * Días en los que una encuesta diaria normal se sustituyó por otra distinta — el 22 de diciembre
 * de 2026 "Cierre del día" (BT) se reemplaza por la encuesta de fiestas (qCode FIESTAS), así que
 * no contestar BT ese día no es "se saltó el slot": nadie lo recibió.
 */
const SLOT_SWAPS: { date: string; replacedQCode: string }[] = [{ date: '2026-12-22', replacedQCode: 'BT' }];

function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function isThirdFridayOfMonth(date: Date): boolean {
  return date.getDay() === 5 && Math.floor((date.getDate() - 1) / 7) === 2;
}

/** True si esa fecha (YYYY-MM-DD) no tuvo ningún envío de Pulso por diseño — feriado puntual, no falla técnica. */
export function isHolidayNoSurveyDate(dateKey: string): boolean {
  return HOLIDAY_NO_SURVEY_DATES.includes(dateKey);
}

/** True si esa fecha es un tercer viernes del mes en el que, como siempre, no hubo encuesta de Viernes (Q1-Q4). */
export function isSkippedViernesDate(dateKey: string): boolean {
  if (VIERNES_SURVEY_OVERRIDES.includes(dateKey)) return false;
  return isThirdFridayOfMonth(parseDateKey(dateKey));
}

/** True si esa encuesta (`qCode`) fue sustituida por otra ese día específico — ej. BT -> FIESTAS el 22 dic 2026. */
export function isSlotSwappedAway(dateKey: string, qCode: string): boolean {
  const upper = qCode.toUpperCase();
  return SLOT_SWAPS.some(s => s.date === dateKey && s.replacedQCode === upper);
}
