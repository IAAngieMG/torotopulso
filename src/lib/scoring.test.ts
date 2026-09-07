import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ResponseRecord } from './pulseData.ts';
import { computeKpis, computeWeeklySeries, computeEnergyDistribution, inRange, rangeWindow } from './scoring.ts';

function rec(partial: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-09-01T13:00:00.000Z',
    responseKey: '',
    surveyName: '',
    qCode: 'BD',
    question: '',
    respondentName: '',
    email: 'a@toroto.mx',
    slackUserId: '',
    groups: '',
    roles: '',
    rawScore: 4,
    score: 8,
    sentiment: '',
    choice: null,
    scheduledDate: '2026-09-01',
    scheduledTime: '',
    ...partial,
  };
}

test('computeKpis calcula promedio BD/BT y participación sobre el roster', () => {
  const records = [
    rec({ qCode: 'BD', rawScore: 4, email: 'a@toroto.mx' }),
    rec({ qCode: 'BD', rawScore: 5, email: 'b@toroto.mx' }),
    rec({ qCode: 'BT', rawScore: 3, email: 'a@toroto.mx' }),
  ];
  const kpis = computeKpis(records, 10);
  assert.equal(kpis.bdAverage, 4.5);
  assert.equal(kpis.btAverage, 3);
  assert.equal(kpis.participationPct, 20);
  assert.equal(kpis.participationDetail, '2 de 10 personas');
});

test('computeKpis con arreglo vacío no truena y regresa null', () => {
  const kpis = computeKpis([], 10);
  assert.equal(kpis.bdAverage, null);
  assert.equal(kpis.btAverage, null);
  assert.equal(kpis.onTimePct, null);
});

test('computeWeeklySeries regresa 5 puntos (lunes a viernes)', () => {
  const points = computeWeeklySeries([], new Date('2026-09-03'));
  assert.equal(points.length, 5);
  assert.deepEqual(points.map(p => p.day), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
});

test('computeEnergyDistribution reparte por el choice de AL', () => {
  const records = [
    rec({ qCode: 'AL', choice: 5 }),
    rec({ qCode: 'AL', choice: 4 }),
    rec({ qCode: 'AL', choice: 3 }),
    rec({ qCode: 'AL', choice: 1 }),
  ];
  const dist = computeEnergyDistribution(records);
  assert.equal(dist?.altaEnergiaPct, 50);
  assert.equal(dist?.enfoquePct, 25);
  assert.equal(dist?.pausaPct, 25);
});

test('computeEnergyDistribution sin respuestas AL regresa null', () => {
  assert.equal(computeEnergyDistribution([rec({ qCode: 'BD' })]), null);
});

test('inRange "lastWeek" toma exactamente la semana anterior a "week", no la de "week" otra vez', () => {
  // Hoy es domingo 6 de septiembre de 2026 -> esta semana es lunes 31 ago - domingo 6 sep;
  // la semana pasada es lunes 24 ago - domingo 30 ago.
  const now = new Date('2026-09-06T12:00:00');
  const respuestaSemanaPasada = rec({ timestamp: '2026-08-28T10:00:00' });
  const respuestaEstaSemana = rec({ timestamp: '2026-09-02T10:00:00' });
  assert.equal(inRange(respuestaSemanaPasada, { range: 'lastWeek', now }), true);
  assert.equal(inRange(respuestaSemanaPasada, { range: 'week', now }), false);
  assert.equal(inRange(respuestaEstaSemana, { range: 'lastWeek', now }), false);
  assert.equal(inRange(respuestaEstaSemana, { range: 'week', now }), true);
});

test('rangeWindow calcula trimestre, semestre y año calendario correctamente', () => {
  const now = new Date('2026-08-15T00:00:00');
  const q = rangeWindow('quarter', now);
  assert.equal(q.start.toISOString().slice(0, 10), '2026-07-01');
  assert.equal(q.end.toISOString().slice(0, 10), '2026-10-01');

  const s = rangeWindow('semester', now);
  assert.equal(s.start.toISOString().slice(0, 10), '2026-07-01');
  assert.equal(s.end.toISOString().slice(0, 10), '2027-01-01');

  const y = rangeWindow('year', now);
  assert.equal(y.start.toISOString().slice(0, 10), '2026-01-01');
  assert.equal(y.end.toISOString().slice(0, 10), '2027-01-01');
});

test('computeWeeklySeries con rango largo agrupa por semana en vez de por día', () => {
  const now = new Date('2026-08-15T00:00:00');
  const records = [
    rec({ qCode: 'BD', rawScore: 4, timestamp: '2026-07-06T09:00:00' }), // dentro del trimestre
    rec({ qCode: 'BD', rawScore: 2, timestamp: '2026-06-01T09:00:00' }), // fuera del trimestre
  ];
  const points = computeWeeklySeries(records, now, 'quarter');
  assert.ok(points.length >= 1);
  assert.ok(points.every(p => !p.day.includes('undefined')));
  const totalBd = points.reduce((s, p) => s + (p.bd ?? 0), 0);
  assert.equal(totalBd, 4, 'solo debe contar la respuesta dentro del trimestre');
});

test('inRange "realtime" solo incluye respuestas de hoy', () => {
  const now = new Date('2026-09-03T12:00:00.000Z');
  assert.equal(inRange(rec({ timestamp: '2026-09-03T08:00:00.000Z' }), { range: 'realtime', now }), true);
  assert.equal(inRange(rec({ timestamp: '2026-09-02T08:00:00.000Z' }), { range: 'realtime', now }), false);
});
