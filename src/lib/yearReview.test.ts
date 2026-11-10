import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPulsoPaused,
  isPulsoPausedWindow,
  yearReviewAccess,
  computeAnnualStats,
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

test('isPulsoPaused solo es true dentro del 28 de diciembre al 3 de enero', () => {
  assert.equal(isPulsoPaused(new Date('2026-12-27T23:00:00.000Z')), false);
  assert.equal(isPulsoPaused(new Date('2026-12-28T06:00:00.000Z')), true);
  assert.equal(isPulsoPaused(new Date('2027-01-03T23:00:00.000Z')), true);
  assert.equal(isPulsoPaused(new Date('2027-01-04T06:00:00.000Z')), false);
});

test('isPulsoPausedWindow detecta traslape con la semana de pausa', () => {
  const start = new Date(2026, 11, 28);
  const end = new Date(2027, 0, 4);
  assert.ok(isPulsoPausedWindow(start, end));
  assert.ok(!isPulsoPausedWindow(new Date(2026, 11, 20), new Date(2026, 11, 27)));
});

test('yearReviewAccess está cerrado para cualquiera antes del 27 de diciembre', () => {
  const now = new Date('2026-12-26T12:00:00.000Z');
  assert.equal(yearReviewAccess('ti@toroto.mx', 'ti@toroto.mx', now).unlocked, false);
  assert.equal(yearReviewAccess('luis@toroto.mx', 'luis@toroto.mx', now).unlocked, false);
});

test('yearReviewAccess: solo Angie entra en la ventana de vista previa (27 dic en adelante)', () => {
  const now = new Date('2026-12-27T12:00:00.000Z');
  assert.equal(yearReviewAccess('ti@toroto.mx', 'ti@toroto.mx', now).unlocked, true);
  assert.equal(yearReviewAccess('luis@toroto.mx', 'luis@toroto.mx', now).unlocked, false);
});

test('yearReviewAccess: Angie puede ver con "Ver como" el acceso real de la persona simulada', () => {
  const now = new Date('2026-12-27T12:00:00.000Z');
  const access = yearReviewAccess('ti@toroto.mx', 'luis@toroto.mx', now);
  assert.equal(access.unlocked, true, 'el candado de fecha se evalúa sobre quién inició sesión, no sobre a quién simula');
  assert.equal(access.preview, true);
  assert.equal(access.canSeeLeader, true, 'Luis lidera equipos');
  assert.equal(access.canSeeRh, false);
});

test('yearReviewAccess: a partir del 4 de enero queda abierto para todos, sin ser vista previa', () => {
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
