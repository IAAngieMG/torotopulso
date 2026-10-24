import './forceNetlifyFlag.ts';
import type { Config } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { fetchSheetRows } from '../../src/lib/sheets.ts';
import { parseRespuestas } from '../../src/lib/pulseData.ts';
import { allTeamNames, rosterForTeams } from '../../src/lib/orgChart.ts';
import { missingSurveysToday } from '../../src/lib/surveyReminders.ts';
import { buildNotification, type NotificationEntry } from '../../src/lib/notifications.ts';
import { sendNotificationEmail } from '../../src/lib/email.ts';

const SIGNAL_LABEL: Record<string, string> = {
  BD: 'Inicio del día',
  AL: 'Alimentos',
  BT: 'Cierre del día',
  VIERNES: 'Encuesta del viernes',
};

function blobsStore(name: string) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  return siteID && token ? getStore({ name, siteID, token }) : getStore(name);
}

/**
 * Corre una vez al día (ver `config.schedule` abajo) y notifica —campanita y, si hay
 * `RESEND_API_KEY` configurada, también correo— a quien todavía no haya contestado alguna
 * encuesta de hoy (Inicio del día, Alimentos, Cierre del día, y Encuesta del viernes los
 * viernes), excluyendo a quien esté de vacaciones/ausente. A diferencia del resto de Pulso, esto
 * le manda a TODA la tropa con correo asignado en el organigrama, no solo a quien tiene acceso al
 * dashboard — por diseño, no suena por completo hasta que `RESEND_API_KEY` esté configurada (ver
 * src/lib/email.ts), para que Angie decida cuándo activarlo de verdad.
 */
export default async () => {
  const sheetId = process.env.SHEET_ID || '';
  const respuestasRows = await fetchSheetRows(sheetId, 'Respuestas');
  const responses = parseRespuestas(respuestasRows);
  const roster = rosterForTeams(allTeamNames());

  const missing = missingSurveysToday(responses, roster);
  if (missing.length === 0) return new Response('ok: nada pendiente');

  const store = blobsStore('pulso-toroto');
  const existing = ((await store.get('notifications', { type: 'json' })) as NotificationEntry[] | null) || [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const alreadyNotified = new Set(
    existing.filter(n => n.type === 'survey_pending' && n.createdAt.slice(0, 10) === todayKey).map(n => `${n.email}|${n.meta}`),
  );

  const appOrigin = process.env.APP_ORIGIN || '';
  const newEntries: NotificationEntry[] = [];
  for (const m of missing) {
    const key = `${m.email}|${m.qCode}`;
    if (alreadyNotified.has(key)) continue;
    const label = SIGNAL_LABEL[m.qCode] || m.qCode;
    newEntries.push(
      buildNotification({
        email: m.email,
        type: 'survey_pending',
        title: `Encuesta pendiente: ${label}`,
        body: `Todavía no contestas la encuesta "${label}" de hoy en Pulso Toroto.`,
        link: '#/',
        meta: m.qCode,
      }),
    );
  }
  if (newEntries.length === 0) return new Response('ok: ya notificado hoy');

  await store.setJSON('notifications', [...existing, ...newEntries]);

  await Promise.all(
    newEntries.map(entry =>
      sendNotificationEmail({
        to: entry.email,
        subject: entry.title,
        heading: entry.title,
        body: entry.body,
        button: { label: 'Entrar a Pulso Toroto', url: `${appOrigin}/${entry.link}` },
      }).catch(() => {}),
    ),
  );

  return new Response(`ok: ${newEntries.length} notificaciones creadas`);
};

export const config: Config = {
  // 01:00 UTC = 19:00 hora CDMX (México ya no usa horario de verano, así que el offset es fijo
  // en -6). El día de la semana en cron es UTC: la noche del lunes-viernes CDMX cae en la
  // madrugada UTC del martes-sábado, por eso "2-6" y no "1-5". Ajusta aquí si Angie prefiere otra
  // hora de corte.
  schedule: '0 1 * * 2-6',
};
