import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ResponseRecord } from './pulseData.ts';
import {
  computeKpis,
  computeWeeklySeries,
  computeEnergyDistribution,
  inRange,
  rangeWindow,
  kpisForPersonInRange,
  computeEntradaInsight,
  computeChoiceBreakdown,
  buildAutoInsight,
} from './scoring.ts';

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
  assert.equal(kpis.overallAverage, null);
  assert.equal(kpis.onTimePct, null);
});

test('overallAverage promedia TODAS las respuestas calificadas (BD, AL, BT, Viernes), no solo BD/BT', () => {
  // Alguien que solo contestó "Alimentos" (sin BD ni BT) sigue sin bdAverage/btAverage, pero
  // overallAverage sí debe reflejar su respuesta — para no mostrarlo como "sin datos" en la
  // tarjeta individual cuando sí tiene actividad.
  const records = [rec({ qCode: 'AL', rawScore: 4 }), rec({ qCode: 'Q1', rawScore: 2 })];
  const kpis = computeKpis(records, 1);
  assert.equal(kpis.bdAverage, null);
  assert.equal(kpis.btAverage, null);
  assert.equal(kpis.overallAverage, 3);
});

test('overallAverage ignora respuestas sin calificación (rawScore null, como un BD de botones)', () => {
  const records = [rec({ qCode: 'BD', rawScore: null, choice: 1 })];
  const kpis = computeKpis(records, 1);
  assert.equal(kpis.overallAverage, null);
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

test('kpisForPersonInRange usa el rango seleccionado, no siempre la semana en curso (bug de Angie González)', () => {
  // Hoy es domingo 6 de septiembre de 2026 -> esta semana es lunes 31 ago - domingo 6 sep;
  // la semana pasada es lunes 24 ago - domingo 30 ago.
  const now = new Date('2026-09-06T12:00:00');
  const email = 'angie.gonzalez@toroto.mx';
  const records = [
    rec({ email, qCode: 'BT', rawScore: 2, timestamp: '2026-08-28T20:00:00' }), // semana pasada
    rec({ email, qCode: 'BT', rawScore: 5, timestamp: '2026-09-02T20:00:00' }), // semana en curso
  ];

  const lastWeekKpis = kpisForPersonInRange(records, email, { range: 'lastWeek', now });
  const thisWeekKpis = kpisForPersonInRange(records, email, { range: 'week', now });

  assert.equal(lastWeekKpis.btAverage, 2);
  assert.equal(thisWeekKpis.btAverage, 5);
});

test('kpisForPersonInRange filtra por email y por señal', () => {
  const now = new Date('2026-09-03T12:00:00.000Z');
  const records = [
    rec({ email: 'a@toroto.mx', qCode: 'BD', rawScore: 4, timestamp: '2026-09-02T13:00:00.000Z' }),
    rec({ email: 'a@toroto.mx', qCode: 'BT', rawScore: 1, timestamp: '2026-09-02T13:00:00.000Z' }),
    rec({ email: 'b@toroto.mx', qCode: 'BD', rawScore: 1, timestamp: '2026-09-02T13:00:00.000Z' }),
  ];
  const kpis = kpisForPersonInRange(records, 'a@toroto.mx', { range: 'week', now }, 'BD');
  assert.equal(kpis.bdAverage, 4);
  assert.equal(kpis.btAverage, null);
});

test('computeEntradaInsight detecta entrada a tiempo (9:00-9:30 CDMX) y el botón elegido', () => {
  const records = [
    rec({ qCode: 'BD', choice: 1, rawScore: null, timestamp: '2026-10-06T15:05:00.000Z' }), // 09:05 CDMX, a tiempo
    rec({ qCode: 'BD', choice: 2, rawScore: null, timestamp: '2026-10-06T15:30:00.000Z' }), // 09:30 CDMX, a tiempo (límite)
    rec({ qCode: 'BD', choice: 2, rawScore: null, timestamp: '2026-10-06T19:00:00.000Z' }), // 13:00 CDMX, tarde
  ];
  const entrada = computeEntradaInsight(records);
  assert.ok(entrada);
  assert.equal(entrada?.total, 3);
  assert.equal(entrada?.onTimePct, 66.7);
  assert.equal(entrada?.yaRegistreCount, 1);
  assert.equal(entrada?.laRegistroAhoraCount, 2);
});

test('computeEntradaInsight regresa null cuando BD no trae choice (semanas con calificación 1-5)', () => {
  assert.equal(computeEntradaInsight([rec({ qCode: 'BD', choice: null, rawScore: 4 })]), null);
});

test('computeChoiceBreakdown reparte por choice y ordena de mayor a menor', () => {
  const records = [
    rec({ qCode: 'AL', choice: 1 }),
    rec({ qCode: 'AL', choice: 1 }),
    rec({ qCode: 'AL', choice: 2 }),
    rec({ qCode: 'AL', choice: 3 }),
  ];
  const breakdown = computeChoiceBreakdown(records, 'AL');
  assert.deepEqual(breakdown[0], { choice: 1, count: 2, pct: 50 });
  assert.equal(breakdown.length, 3);
});

test('buildAutoInsight basa el clima en BT cuando BD es de botones (sin rawScore)', () => {
  const kpis = {
    bdAverage: null,
    btAverage: 4.5,
    overallAverage: 4.5,
    participationPct: 100,
    participationDetail: '2 de 2 personas',
    onTimePct: null,
  };
  const records = [
    rec({ qCode: 'BD', choice: 1, rawScore: null, timestamp: '2026-10-06T15:05:00.000Z' }),
    rec({ qCode: 'BD', choice: 2, rawScore: null, timestamp: '2026-10-06T19:00:00.000Z' }),
  ];
  const insight = buildAutoInsight(kpis, [], 'la tropa', records);
  assert.match(insight.headline, /estable y positivo/);
  assert.ok(insight.bullets.some(b => b.includes('registró su entrada a tiempo')));
});
