import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLeaderBriefRows, logAccessEvent, sendLeaderBriefRows } from './accessLog.ts';
import type { ResponseRecord } from './pulseData.ts';

function record(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-11-11T14:00:00.000Z',
    responseKey: 'k',
    surveyName: 'BD',
    qCode: 'BD',
    question: 'q',
    respondentName: 'Persona',
    email: 'luis@toroto.mx',
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

test('buildLeaderBriefRows incluye una fila por cada cuenta con acceso (líderes, visión global, restringido)', () => {
  const rows = buildLeaderBriefRows([]);
  const emails = rows.map(r => r.email);
  assert.ok(emails.includes('luis@toroto.mx'), 'cualquier líder de equipo debe aparecer');
  assert.ok(emails.includes('santiago@toroto.mx'), 'visión global debe aparecer');
  assert.ok(emails.includes('samantha@toroto.mx'), 'acceso restringido (RH) debe aparecer');
  assert.ok(!emails.includes('ana@toroto.mx'), 'quien no tiene acceso al dashboard no debe aparecer');
});

test('buildLeaderBriefRows calcula el promedio y la participación del equipo de un líder', () => {
  const now = new Date('2026-11-11T18:00:00.000Z');
  const records = [
    record({ email: 'luis@toroto.mx', qCode: 'BD', rawScore: 4, timestamp: now.toISOString() }),
    record({ email: 'karen@toroto.mx', qCode: 'BT', rawScore: 4, timestamp: now.toISOString() }),
  ];
  const rows = buildLeaderBriefRows(records, now);
  const luis = rows.find(r => r.email === 'luis@toroto.mx')!;
  assert.ok(luis);
  assert.equal(luis.team, 'Gerencia de Restauración Territorial');
  assert.equal(luis.bdAverage, 4);
  assert.ok(luis.participationPct !== null);
  assert.equal(typeof luis.redFlagsCount, 'number');
});

test('logAccessEvent y sendLeaderBriefRows no truenan cuando ACCESS_LOG_WEBHOOK_URL no está configurada', async () => {
  delete process.env.ACCESS_LOG_WEBHOOK_URL;
  assert.doesNotThrow(() => logAccessEvent({ type: 'login', email: 'luis@toroto.mx', name: 'Luis' }));
  await assert.doesNotReject(sendLeaderBriefRows([]));
});
