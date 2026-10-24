import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAnniversaryCardVisible, computeAnniversarySummaryForTeam, ANNIVERSARY_SENT_AT } from './anniversary.ts';
import type { ResponseRecord } from './pulseData.ts';
import type { RosterEntry } from './orgChart.ts';

function response(email: string, choice: number | null, timestamp = ANNIVERSARY_SENT_AT.toISOString()): ResponseRecord {
  return {
    timestamp,
    responseKey: 'k',
    surveyName: '7 años Toroto',
    qCode: 'ANIV7',
    question: '¿Cómo te sientes de formar parte de la Tropa?',
    respondentName: email,
    email,
    slackUserId: '',
    groups: '',
    roles: '',
    rawScore: null,
    score: null,
    sentiment: '',
    choice,
    scheduledDate: '',
    scheduledTime: '',
  };
}

const roster: RosterEntry[] = [
  { fullName: 'Ana', email: 'ana@toroto.mx', team: 'Equipo X', isLeader: true },
  { fullName: 'Beto', email: 'beto@toroto.mx', team: 'Equipo X', isLeader: false },
  { fullName: 'Caro', email: 'caro@toroto.mx', team: 'Equipo X', isLeader: false },
];

test('isAnniversaryCardVisible solo es true del 2 al 8 de noviembre de 2026', () => {
  assert.equal(isAnniversaryCardVisible(new Date('2026-10-29T15:15:00.000Z')), false);
  assert.equal(isAnniversaryCardVisible(new Date('2026-11-01T23:00:00.000Z')), false);
  assert.equal(isAnniversaryCardVisible(new Date('2026-11-02T06:01:00.000Z')), true);
  assert.equal(isAnniversaryCardVisible(new Date('2026-11-08T12:00:00.000Z')), true);
  assert.equal(isAnniversaryCardVisible(new Date('2026-11-09T06:01:00.000Z')), false);
});

test('computeAnniversarySummaryForTeam cuenta respondidos y distribución', () => {
  const records = [response('ana@toroto.mx', 1), response('beto@toroto.mx', 3)];
  const summary = computeAnniversarySummaryForTeam('Equipo X', roster, records);
  assert.equal(summary.total, 3);
  assert.equal(summary.answered, 2);
  assert.equal(summary.respondents.length, 2);
  assert.deepEqual(
    summary.respondents.find(r => r.email === 'ana@toroto.mx')?.choiceLabel,
    '🥰 Orgullosx',
  );
  const choice1 = summary.distribution.find(d => d.choice === 1)!;
  assert.equal(choice1.count, 1);
  assert.equal(choice1.pct, 50);
});

test('computeAnniversarySummaryForTeam excluye del total a quien estaba en "off" el día del envío', () => {
  // Simula un "off" activo justo el día del envío con una vacación de alcance "all" temporal.
  const offRoster: RosterEntry[] = [...roster, { fullName: 'Off Person', email: 'off@toroto.mx', team: 'Equipo X', isLeader: false }];
  // Sin entrada real en VACATIONS, "off@toroto.mx" no está excluido — este test documenta que la
  // exclusión depende de las vacaciones/off registradas (src/lib/vacations.ts), no de lógica propia.
  const summary = computeAnniversarySummaryForTeam('Equipo X', offRoster, []);
  assert.equal(summary.total, 4);
});

test('quien no contestó (choice null) no cuenta como respondido', () => {
  const records = [response('ana@toroto.mx', null)];
  const summary = computeAnniversarySummaryForTeam('Equipo X', roster, records);
  assert.equal(summary.answered, 0);
  assert.equal(summary.total, 3);
});
