import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPulsoPaused,
  isPulsoPausedWindow,
  pulsoPauseNoteForRange,
  yearReviewAccess,
  computeAnnualStats,
  computePersonAnnualFlags,
  computeTeamOpportunity,
  rankPersonOpportunities,
  buildWishes,
  groupResponsesByEmail,
} from './yearReview.ts';
import { teamByName } from './orgChart.ts';
import type { ResponseRecord } from './pulseData.ts';

function record(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-03-10T14:00:00.000Z',
    responseKey: 'k',
    surveyName: 'BD',
    qCode: 'BD',
    question: 'q',
    respondentName: 'Persona',
    email: 'persona@toroto.mx',
    slackUserId: '',
    groups: '',
    roles: '',
    rawScore: 5,
    score: 10,
    sentiment: '',
    choice: null,
    scheduledDate: '',
    scheduledTime: '',
    ...overrides,
  };
}

test('isPulsoPaused solo es true dentro del 23 de diciembre al 3 de enero', () => {
  assert.equal(isPulsoPaused(new Date('2026-12-22T23:00:00.000Z')), false);
  assert.equal(isPulsoPaused(new Date('2026-12-23T06:00:00.000Z')), true);
  assert.equal(isPulsoPaused(new Date('2027-01-03T23:00:00.000Z')), true);
  assert.equal(isPulsoPaused(new Date('2027-01-04T06:00:00.000Z')), false);
});

test('isPulsoPausedWindow detecta traslape con la semana de pausa', () => {
  const start = new Date(2026, 11, 23);
  const end = new Date(2027, 0, 4);
  assert.ok(isPulsoPausedWindow(start, end));
  assert.ok(!isPulsoPausedWindow(new Date(2026, 11, 15), new Date(2026, 11, 22)));
});

test('pulsoPauseNoteForRange solo regresa la nota cuando el rango toca la pausa de fin de año', () => {
  const notes = pulsoPauseNoteForRange(new Date(2026, 11, 20), new Date(2026, 11, 27));
  assert.equal(notes.length, 1);
  assert.match(notes[0], /pausa/i);
  assert.equal(pulsoPauseNoteForRange(new Date(2026, 11, 1), new Date(2026, 11, 20)).length, 0);
});

test('computePersonAnnualFlags no cuenta "Cierre del día" como pendiente el 22 de diciembre de 2026 (sustituido por Fiestas)', () => {
  const records: ResponseRecord[] = [
    {
      timestamp: '2026-12-22T15:00:00.000Z',
      responseKey: 'k1',
      surveyName: 'BD',
      qCode: 'BD',
      question: 'q',
      respondentName: 'Persona',
      email: 'persona@toroto.mx',
      slackUserId: '',
      groups: '',
      roles: '',
      rawScore: 5,
      score: 10,
      sentiment: '',
      choice: null,
      scheduledDate: '',
      scheduledTime: '',
    },
    {
      timestamp: '2026-12-22T20:00:00.000Z',
      responseKey: 'k2',
      surveyName: 'Alimentos',
      qCode: 'AL',
      question: 'q',
      respondentName: 'Persona',
      email: 'persona@toroto.mx',
      slackUserId: '',
      groups: '',
      roles: '',
      rawScore: null,
      score: null,
      sentiment: '',
      choice: 2,
      scheduledDate: '',
      scheduledTime: '',
    },
  ];
  const flags = computePersonAnnualFlags('persona@toroto.mx', 'Persona', 'Equipo', records, 2026);
  assert.equal(flags.missingCount, 0, 'no debe contar BT como pendiente el 22/12, lo sustituyó Fiestas');
});

test('yearReviewAccess: antes del 4 de diciembre, solo Angie entra (vista previa) y nadie más', () => {
  const now = new Date('2026-11-28T12:00:00.000Z');
  assert.equal(yearReviewAccess('ti@toroto.mx', 'ti@toroto.mx', now).unlocked, true, 'la vista previa de Angie ya está activa desde el 1 de noviembre');
  assert.equal(yearReviewAccess('luis@toroto.mx', 'luis@toroto.mx', now).unlocked, false);
});

test('yearReviewAccess: a partir del 4 de diciembre (coincide con el primer viernes de Cierre de año) ya no es vista previa para nadie', () => {
  const now = new Date('2026-12-04T12:00:00.000Z');
  const angie = yearReviewAccess('ti@toroto.mx', 'ti@toroto.mx', now);
  const luis = yearReviewAccess('luis@toroto.mx', 'luis@toroto.mx', now);
  assert.equal(angie.unlocked, true);
  assert.equal(angie.preview, false, 'desde el 4 de diciembre ya está "live", no es vista previa ni para Angie');
  assert.equal(luis.unlocked, true, 'los líderes ya entran el 4 de diciembre, no hasta el 4 de enero');
  assert.equal(luis.preview, false);
});

test('yearReviewAccess: Angie puede ver con "Ver como" el acceso real de la persona simulada, antes del 4 de diciembre', () => {
  const now = new Date('2026-11-28T12:00:00.000Z');
  const access = yearReviewAccess('ti@toroto.mx', 'luis@toroto.mx', now);
  assert.equal(access.unlocked, true, 'el candado de fecha se evalúa sobre quién inició sesión, no sobre a quién simula');
  assert.equal(access.preview, true);
  assert.equal(access.canSeeLeader, true, 'Luis lidera equipos');
  assert.equal(access.canSeeRh, false);
});

test('yearReviewAccess: a partir del 4 de enero sigue abierto para todos, sin ser vista previa', () => {
  const now = new Date('2027-01-04T12:00:00.000Z');
  const access = yearReviewAccess('luis@toroto.mx', 'luis@toroto.mx', now);
  assert.equal(access.unlocked, true);
  assert.equal(access.preview, false);
  assert.equal(access.canSeeLeader, true);
});

test('yearReviewAccess: canSeeRh solo para patricia, karla y samantha', () => {
  const now = new Date('2027-01-04T12:00:00.000Z');
  assert.equal(yearReviewAccess('karla@toroto.mx', 'karla@toroto.mx', now).canSeeRh, true);
  assert.equal(yearReviewAccess('karla@toroto.mx', 'karla@toroto.mx', now).canSeeLeader, false, 'Karla no lidera ningún equipo');
  assert.equal(yearReviewAccess('juan@toroto.mx', 'juan@toroto.mx', now).canSeeRh, false);
});

test('computeAnnualStats promedia BD/BT del año y calcula el mejor mes', () => {
  const records = [
    record({ timestamp: '2026-03-10T14:00:00.000Z', qCode: 'BD', rawScore: 5, email: 'a@toroto.mx' }),
    record({ timestamp: '2026-03-10T20:00:00.000Z', qCode: 'BT', rawScore: 5, email: 'a@toroto.mx' }),
    record({ timestamp: '2026-07-01T14:00:00.000Z', qCode: 'BD', rawScore: 2, email: 'a@toroto.mx' }),
    record({ timestamp: '2025-03-10T14:00:00.000Z', qCode: 'BD', rawScore: 1, email: 'a@toroto.mx' }), // otro año, se ignora
  ];
  const stats = computeAnnualStats(records, 1, 2026);
  assert.equal(stats.totalResponses, 3);
  assert.equal(stats.bestMonth, 'Mar');
  assert.equal(stats.participationPct, 100);
});

test('computeTeamOpportunity marca "warn" cuando la participación o el promedio son bajos', () => {
  const team = teamByName('RH')!;
  const byEmail = groupResponsesByEmail([
    record({ timestamp: '2026-02-02T14:00:00.000Z', qCode: 'BD', rawScore: 2, email: 'patricia@toroto.mx' }),
  ]);
  const opp = computeTeamOpportunity(team, byEmail, 2026);
  assert.equal(opp.status, 'warn');
  assert.ok(opp.note.length > 0);
});

test('computeTeamOpportunity marca "good" con buen promedio y buena participación', () => {
  const team = teamByName('RH')!;
  const emails = ['patricia@toroto.mx', 'samantha@toroto.mx', 'karla@toroto.mx'];
  const records: ResponseRecord[] = [];
  for (const email of emails) {
    for (let month = 0; month < 12; month++) {
      records.push(record({ timestamp: `2026-${String(month + 1).padStart(2, '0')}-05T14:00:00.000Z`, qCode: 'BD', rawScore: 5, email }));
      records.push(record({ timestamp: `2026-${String(month + 1).padStart(2, '0')}-05T20:00:00.000Z`, qCode: 'BT', rawScore: 5, email }));
    }
  }
  const opp = computeTeamOpportunity(team, groupResponsesByEmail(records), 2026);
  assert.equal(opp.status, 'good');
});

test('rankPersonOpportunities separa a quienes tienen oportunidades de quienes no tienen ninguna', () => {
  const roster = [
    { email: 'conflagas@toroto.mx', fullName: 'Con Flags', team: 'Equipo' },
    { email: 'limpia@toroto.mx', fullName: 'Limpia', team: 'Equipo' },
  ];
  const byEmail = groupResponsesByEmail([
    record({ timestamp: '2026-05-05T14:00:00.000Z', qCode: 'BD', rawScore: 2, email: 'conflagas@toroto.mx' }),
    record({ timestamp: '2026-05-05T14:00:00.000Z', qCode: 'BD', rawScore: 5, email: 'limpia@toroto.mx' }),
    record({ timestamp: '2026-05-05T17:00:00.000Z', qCode: 'AL', rawScore: null, email: 'limpia@toroto.mx' }),
    record({ timestamp: '2026-05-05T20:00:00.000Z', qCode: 'BT', rawScore: 5, email: 'limpia@toroto.mx' }),
  ]);
  const { opportunities, highlights } = rankPersonOpportunities(roster, byEmail, 2026);
  assert.deepEqual(opportunities.map(o => o.email), ['conflagas@toroto.mx']);
  assert.deepEqual(highlights.map(h => h.email), ['limpia@toroto.mx']);
});

test('buildWishes siempre regresa 12 deseos, uno por mes', () => {
  const wishes = buildWishes([]);
  assert.equal(wishes.length, 12);
  assert.equal(wishes[0].month, 'Enero');
  assert.equal(wishes[11].month, 'Diciembre');
  assert.ok(wishes.every(w => w.text.length > 0));
});
