import type { ResponseRecord } from './pulseData.ts';
import { CIERRE_DE_ANO_QCODES, FIESTAS_QCODE, isFridaySignal } from './pulseData.ts';
import { isExcludedFromSignal } from './vacations.ts';
import { isPulsoPaused } from './yearReview.ts';
import { isHolidayNoSurveyDate, isSkippedViernesDate } from './yearEndSchedule.ts';

export type DailySignal = 'BD' | 'AL' | 'BT' | 'VIERNES';

export interface MissingSurvey {
  email: string;
  qCode: DailySignal;
}

const MEXICO_TZ = 'America/Mexico_City';

function localDateKey(d: Date, tz = MEXICO_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function isFridayLocal(d: Date, tz = MEXICO_TZ): boolean {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d) === 'Fri';
}

/**
 * Qué encuestas (BD/AL/BT siempre, VIERNES solo los viernes) de HOY le faltan a cada persona del
 * roster, excluyendo a quien esté de vacaciones/ausente para ese signal (`vacations.ts`, y lo que
 * agregue ahí la exclusión de "en off").
 *
 * No existe en este repo la hora exacta en la que Polly manda cada encuesta por WhatsApp (vive
 * fuera, del lado de Polly) — así que esto no distingue "todavía no le toca" de "ya le tocó y no
 * contestó": asume que para la hora en que corre este chequeo (ver `survey-reminders.ts`, pensado
 * para correr una vez al día cerca del final de la jornada) ya debió haber contestado todo lo de
 * hoy. Si Angie prefiere otra hora, se ajusta el cron de esa función, no esta lógica.
 *
 * Durante la pausa general de fin de año y en feriados puntuales no se espera nada de nadie (ver
 * `yearReview.ts`/`yearEndSchedule.ts`); el tercer viernes de cada mes no requiere VIERNES salvo
 * excepción explícita; y en diciembre de 2026 "Cierre de año" (CA1-3) cuenta como VIERNES y
 * "Fiestas" (22 dic) cuenta como BT, porque ese día la sustituye.
 */
export function missingSurveysToday(responses: ResponseRecord[], roster: { email: string }[], now: Date = new Date()): MissingSurvey[] {
  const todayKey = localDateKey(now);
  // Pausa general de fin de año, o un feriado puntual (ver yearReview.ts/yearEndSchedule.ts):
  // nadie recibe nada hoy, así que no hay nada que recordar.
  if (isPulsoPaused(now) || isHolidayNoSurveyDate(todayKey)) return [];
  // El tercer viernes del mes normalmente no tiene encuesta de Viernes (salvo fechas con
  // excepción explícita, ej. el 18 de diciembre de 2026 — ver yearEndSchedule.ts).
  const includeViernes = isFridayLocal(now) && !isSkippedViernesDate(todayKey);
  const slots: DailySignal[] = includeViernes ? ['BD', 'AL', 'BT', 'VIERNES'] : ['BD', 'AL', 'BT'];

  const answeredToday = new Set<string>();
  for (const r of responses) {
    if (!r.email || !r.timestamp) continue;
    const ts = new Date(r.timestamp);
    if (Number.isNaN(ts.getTime()) || localDateKey(ts) !== todayKey) continue;
    // "Cierre de año" (CA1-3, los viernes de diciembre) cuenta como la encuesta de Viernes del
    // día; "Fiestas" (22 de diciembre) cuenta como "Cierre del día" (BT), que ese día sustituye.
    const slot: DailySignal =
      CIERRE_DE_ANO_QCODES.includes(r.qCode) || isFridaySignal(r.qCode)
        ? 'VIERNES'
        : r.qCode === FIESTAS_QCODE
          ? 'BT'
          : (r.qCode.toUpperCase() as DailySignal);
    answeredToday.add(`${r.email.trim().toLowerCase()}|${slot}`);
  }

  const missing: MissingSurvey[] = [];
  const seenEmails = new Set<string>();
  for (const person of roster) {
    const email = person.email?.trim().toLowerCase();
    if (!email || seenEmails.has(email)) continue;
    seenEmails.add(email);
    for (const qCode of slots) {
      if (isExcludedFromSignal(email, qCode, now)) continue;
      if (answeredToday.has(`${email}|${qCode}`)) continue;
      missing.push({ email, qCode });
    }
  }
  return missing;
}
