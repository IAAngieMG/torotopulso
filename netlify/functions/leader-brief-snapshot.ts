import './forceNetlifyFlag.ts';
import type { Config } from '@netlify/functions';
import { fetchSheetRows } from '../../src/lib/sheets.ts';
import { parseRespuestas } from '../../src/lib/pulseData.ts';
import { buildLeaderBriefRows, sendLeaderBriefRows } from '../../src/lib/accessLog.ts';

/**
 * Corre una vez al día (ver `config.schedule`) y manda a la pestaña "Brief por líder" del Sheet
 * el mismo tipo de dato que cualquier líder vería en su dashboard (o jalaría por el conector MCP):
 * su pulso de la semana en curso y cuántas red flags tiene activas ahora mismo. Si
 * `ACCESS_LOG_WEBHOOK_URL` no está configurada, `sendLeaderBriefRows` no hace nada.
 */
export default async () => {
  const sheetId = process.env.SHEET_ID || '';
  const responses = parseRespuestas(await fetchSheetRows(sheetId, 'Respuestas'));
  const rows = buildLeaderBriefRows(responses);
  if (rows.length === 0) return new Response('ok: sin líderes con acceso');

  await sendLeaderBriefRows(rows);
  return new Response(`ok: ${rows.length} filas de brief enviadas`);
};

export const config: Config = {
  // 13:00 UTC = 7:00 am hora CDMX (sin horario de verano en México, offset fijo -6), lunes a viernes.
  schedule: '0 13 * * 1-5',
};
