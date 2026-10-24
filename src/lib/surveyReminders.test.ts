import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingSurveysToday } from './surveyReminders.ts';
import type { ResponseRecord } from './pulseData.ts';

function response(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-10-21T18:00:00.000Z',
    responseKey: 'k',
    surveyName: 'Pulso',
    qCode: 'BD',
    question: '',
    respondentName: '',
    email: 'a@toroto.mx',
    slackUserId: '',
    groups: '',
    roles: '',
    rawScore: null,
    score: null,
    sentiment: '',
    choice: null,
    scheduledDate: '',
    scheduledTime: '',
    ...overrides,
  };
}

// 2026-10-21 es miércoles (hora CDMX); 2026-10-23 es viernes.
const WEDNESDAY = new Date('2026-10-21T18:00:00.000Z');
const FRIDAY = new Date('2026-10-23T18:00:00.000Z');

test('un miércoles sin respuestas, falta BD/AL/BT (no VIERNES) para todos', () => {
  const roster = [{ email: 'a@toroto.mx' }, { email: 'b@toroto.mx' }];
  const missing = missingSurveysToday([], roster, WEDNESDAY);
  const keys = missing.map(m => `${m.email}|${m.qCode}`).sort();
  assert.deepEqual(keys, [
    'a@toroto.mx|AL',
    'a@toroto.mx|BD',
    'a@toroto.mx|BT',
    'b@toroto.mx|AL',
    'b@toroto.mx|BD',
    'b@toroto.mx|BT',
  ]);
});

test('quien ya contestó un slot hoy no aparece como pendiente de ese slot', () => {
  const roster = [{ email: 'a@toroto.mx' }];
  const responses = [response({ qCode: 'BD' }), response({ qCode: 'BT' })];
  const missing = missingSurveysToday(responses, roster, WEDNESDAY);
  assert.deepEqual(missing.map(m => m.qCode), ['AL']);
});

test('un viernes, además de BD/AL/BT falta VIERNES si no hay respuesta de ese tipo', () => {
  const roster = [{ email: 'a@toroto.mx' }];
  // qCode "Q2" no es BD/AL/BT, así que pulseData.isFridaySignal lo cuenta como la encuesta del viernes.
  const responses = [response({ qCode: 'Q2', timestamp: '2026-10-23T18:00:00.000Z' })];
  const missing = missingSurveysToday(responses, roster, FRIDAY);
  assert.deepEqual(missing.map(m => m.qCode).sort(), ['AL', 'BD', 'BT']);
});

test('quien está de vacaciones (scope "all") no aparece como pendiente ningún día de esas fechas', () => {
  // david@toroto.mx está de vacaciones del 5 al 26 de octubre 2026 (vacations.ts).
  const roster = [{ email: 'david@toroto.mx' }];
  const missing = missingSurveysToday([], roster, WEDNESDAY);
  assert.deepEqual(missing, []);
});

test('un correo repetido en el roster (ej. líder de dos equipos) no duplica la notificación', () => {
  const roster = [{ email: 'a@toroto.mx' }, { email: 'A@toroto.mx' }];
  const missing = missingSurveysToday([], roster, WEDNESDAY);
  assert.equal(missing.filter(m => m.qCode === 'BD').length, 1);
});
