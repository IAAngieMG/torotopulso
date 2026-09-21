import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRedFlagsForPerson, computeRedFlagsForRoster, buildRecommendation } from './redFlags.ts';
import type { ResponseRecord } from './pulseData.ts';

const NOW = new Date('2026-09-18T18:00:00.000Z'); // viernes

function record(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-09-17T15:00:00.000Z',
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

test('sin respuestas recientes solo genera la red flag de silencio, no las demás', () => {
  const flags = computeRedFlagsForPerson([], NOW);
  assert.ok(flags.every(f => f.type === 'silence'), JSON.stringify(flags));
});

test('varios días hábiles sin ninguna respuesta genera la red flag de silencio', () => {
  // Última respuesta fue el lunes 14 de septiembre; hoy es viernes 18 -> 4 días hábiles de silencio (martes-viernes).
  const flags = computeRedFlagsForPerson([record({ timestamp: '2026-09-14T14:00:00.000Z' })], NOW);
  assert.ok(flags.some(f => f.type === 'silence'), JSON.stringify(flags));
});

test('responder Inicio del día después de las 10:00 am hora CDMX es red flag', () => {
  // 16:30 UTC == 10:30 am CDMX (UTC-6)
  const flags = computeRedFlagsForPerson([record({ timestamp: '2026-09-17T16:30:00.000Z', qCode: 'BD' })], NOW);
  assert.ok(flags.some(f => f.type === 'late_morning'), JSON.stringify(flags));
});

test('responder Inicio del día antes de las 10:00 am hora CDMX no genera red flag de tardanza', () => {
  // 14:00 UTC == 8:00 am CDMX
  const flags = computeRedFlagsForPerson([record({ timestamp: '2026-09-17T14:00:00.000Z', qCode: 'BD' })], NOW);
  assert.ok(!flags.some(f => f.type === 'late_morning'), JSON.stringify(flags));
});

test('un día activo (respondió BD) sin responder Alimentos ni Cierre del día genera red flags de faltante', () => {
  const flags = computeRedFlagsForPerson([record({ timestamp: '2026-09-17T14:00:00.000Z', qCode: 'BD' })], NOW);
  const missing = flags.filter(f => f.type === 'missing_response');
  assert.equal(missing.length, 2, JSON.stringify(flags));
});

test('completar los 3 slots de un día no genera red flags de faltante ese día', () => {
  const flags = computeRedFlagsForPerson(
    [
      record({ timestamp: '2026-09-17T14:00:00.000Z', qCode: 'BD' }),
      record({ timestamp: '2026-09-17T17:00:00.000Z', qCode: 'AL' }),
      record({ timestamp: '2026-09-17T23:00:00.000Z', qCode: 'BT' }),
    ],
    NOW,
  );
  assert.ok(!flags.some(f => f.type === 'missing_response'), JSON.stringify(flags));
});

test('una calificación menor a 4 genera red flag de calificación baja', () => {
  const flags = computeRedFlagsForPerson([record({ timestamp: '2026-09-17T14:00:00.000Z', qCode: 'BT', rawScore: 2 })], NOW);
  assert.ok(flags.some(f => f.type === 'low_score' && f.message.includes('2/5')), JSON.stringify(flags));
});

test('una calificación de 4 o más no genera red flag', () => {
  const flags = computeRedFlagsForPerson(
    [
      record({ timestamp: '2026-09-17T14:00:00.000Z', qCode: 'BD', rawScore: 4 }),
      record({ timestamp: '2026-09-17T17:00:00.000Z', qCode: 'AL', rawScore: 5 }),
      record({ timestamp: '2026-09-17T23:00:00.000Z', qCode: 'BT', rawScore: 4 }),
    ],
    NOW,
  );
  assert.ok(!flags.some(f => f.type === 'low_score'), JSON.stringify(flags));
});

test('buildRecommendation sugiere apoyo de RH cuando hay una red flag de severidad alta', () => {
  assert.match(buildRecommendation([{ type: 'low_score', severity: 'alta', message: '' }]), /RH/);
  assert.doesNotMatch(buildRecommendation([{ type: 'missing_response', severity: 'media', message: '' }]), /RH/);
});

test('computeRedFlagsForRoster solo regresa a quienes tienen al menos una red flag, con managers primero', () => {
  const roster = [
    { email: 'sana@toroto.mx', fullName: 'Sana', team: 'Equipo' },
    { email: 'silenciosa@toroto.mx', fullName: 'Silenciosa', team: 'Equipo' },
  ];
  const records: ResponseRecord[] = [
    record({ email: 'sana@toroto.mx', timestamp: '2026-09-17T14:00:00.000Z', qCode: 'BD' }),
    record({ email: 'sana@toroto.mx', timestamp: '2026-09-17T17:00:00.000Z', qCode: 'AL' }),
    record({ email: 'sana@toroto.mx', timestamp: '2026-09-17T23:00:00.000Z', qCode: 'BT' }),
    record({ email: 'silenciosa@toroto.mx', timestamp: '2026-09-10T14:00:00.000Z', qCode: 'BD' }),
  ];
  const result = computeRedFlagsForRoster(roster, records, NOW);
  assert.equal(result.length, 1);
  assert.equal(result[0].email, 'silenciosa@toroto.mx');
});
