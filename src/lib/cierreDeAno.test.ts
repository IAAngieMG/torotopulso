import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCierreDeAnoStats, computeFiestasBreakdown, FIESTAS_OPTIONS } from './cierreDeAno.ts';
import type { ResponseRecord } from './pulseData.ts';

function record(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-12-04T15:00:00.000Z',
    responseKey: 'k',
    surveyName: 'Cierre de año',
    qCode: 'CA1',
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

test('computeCierreDeAnoStats promedia cada pregunta (CA1-3) por separado, nunca juntas', () => {
  const records = [
    record({ qCode: 'CA1', rawScore: 5, email: 'a@toroto.mx' }),
    record({ qCode: 'CA1', rawScore: 3, email: 'b@toroto.mx' }),
    record({ qCode: 'CA2', rawScore: 4, email: 'a@toroto.mx' }),
    record({ qCode: 'BD', rawScore: 1, email: 'a@toroto.mx' }), // no debe contaminar CA1/CA2/CA3
  ];
  const stats = computeCierreDeAnoStats(records);
  const ca1 = stats.find(s => s.qCode === 'CA1')!;
  const ca2 = stats.find(s => s.qCode === 'CA2')!;
  const ca3 = stats.find(s => s.qCode === 'CA3')!;
  assert.equal(ca1.average, 4);
  assert.equal(ca1.totalResponses, 2);
  assert.equal(ca2.average, 4);
  assert.equal(ca2.totalResponses, 1);
  assert.equal(ca3.average, null, 'sin respuestas de CA3 en este set');
  assert.equal(ca3.totalResponses, 0);
});

test('computeFiestasBreakdown reparte porcentajes por opción y nunca promedia como ánimo', () => {
  const records = [
    record({ qCode: 'FIESTAS', choice: 1, rawScore: null, email: 'a@toroto.mx' }),
    record({ qCode: 'FIESTAS', choice: 1, rawScore: null, email: 'b@toroto.mx' }),
    record({ qCode: 'FIESTAS', choice: 3, rawScore: null, email: 'c@toroto.mx' }),
    record({ qCode: 'FIESTAS', choice: 5, rawScore: null, email: 'd@toroto.mx' }),
  ];
  const breakdown = computeFiestasBreakdown(records);
  assert.equal(breakdown.length, FIESTAS_OPTIONS.length);
  const casa = breakdown.find(b => b.choice === 1)!;
  const amigos = breakdown.find(b => b.choice === 3)!;
  const comiendo = breakdown.find(b => b.choice === 5)!;
  const viaje = breakdown.find(b => b.choice === 2)!;
  assert.equal(casa.count, 2);
  assert.equal(casa.pct, 50);
  assert.equal(amigos.pct, 25);
  assert.equal(comiendo.pct, 25);
  assert.equal(viaje.count, 0);
  assert.equal(viaje.pct, 0);
});

test('computeFiestasBreakdown con cero respuestas regresa 0% en todas las opciones, no null/NaN', () => {
  const breakdown = computeFiestasBreakdown([]);
  assert.ok(breakdown.every(b => b.count === 0 && b.pct === 0));
});
