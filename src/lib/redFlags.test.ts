import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRedFlagsForPerson, computeRedFlagsForRoster, buildRecommendation, buildFlagContext } from './redFlags.ts';
import type { ResponseRecord } from './pulseData.ts';

// Lunes 28 de septiembre 2026 -> "semana pasada" = lunes 21 a viernes 25 de septiembre.
const NOW = new Date('2026-09-28T15:00:00.000Z');
const EMAIL = 'persona@toroto.mx';

function record(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-09-21T15:00:00.000Z',
    responseKey: 'k',
    surveyName: 'BD',
    qCode: 'BD',
    question: 'q',
    respondentName: 'Persona',
    email: EMAIL,
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

test('sin respuestas en la semana pasada solo genera la red flag de silencio, no las demás', () => {
  const flags = computeRedFlagsForPerson(EMAIL, [], NOW);
  assert.ok(flags.every(f => f.type === 'silence'), JSON.stringify(flags));
  assert.ok(flags.some(f => f.message.includes('5 de 5 días hábiles')), JSON.stringify(flags));
});

test('respuestas en tiempo real de la semana en curso (hoy, después de "lastWeek") no cuentan para las red flags', () => {
  // Si contara "en tiempo real" (rolling desde ahora), esta respuesta de hoy evitaría el silencio.
  const flags = computeRedFlagsForPerson(EMAIL, [record({ timestamp: NOW.toISOString() })], NOW);
  assert.ok(flags.some(f => f.type === 'silence'), 'una respuesta de hoy no debe evitar el silencio de la semana pasada');
});

test('varios días hábiles de la semana pasada sin ninguna respuesta genera la red flag de silencio', () => {
  // Solo respondió el lunes; martes a viernes (4 días) sin nada.
  const flags = computeRedFlagsForPerson(EMAIL, [record({ timestamp: '2026-09-21T15:00:00.000Z' })], NOW);
  assert.ok(flags.some(f => f.type === 'silence'), JSON.stringify(flags));
});

test('exactamente 3 días hábiles sin responder (de 5) NO genera red flag de silencio: solo cuenta si son más de 3', () => {
  // Respondió lunes y martes; miércoles, jueves y viernes (3 días) sin nada.
  const flags = computeRedFlagsForPerson(
    EMAIL,
    [record({ timestamp: '2026-09-21T15:00:00.000Z' }), record({ timestamp: '2026-09-22T15:00:00.000Z' })],
    NOW,
  );
  assert.ok(!flags.some(f => f.type === 'silence'), JSON.stringify(flags));
});

const WEEKDAYS_LAST_WEEK = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];

test('responder Inicio del día tarde UN SOLO día no genera red flag de tardanza (no es un patrón)', () => {
  // 16:30 UTC == 10:30 am CDMX (UTC-6), lunes de la semana pasada.
  const flags = computeRedFlagsForPerson(EMAIL, [record({ timestamp: '2026-09-21T16:30:00.000Z', qCode: 'BD' })], NOW);
  assert.ok(!flags.some(f => f.type === 'late_morning'), JSON.stringify(flags));
});

test('responder Inicio del día tarde en 4 de 5 días sí genera red flag de tardanza', () => {
  const records = WEEKDAYS_LAST_WEEK.slice(0, 4).map(day => record({ timestamp: `${day}T16:30:00.000Z`, qCode: 'BD' }));
  const flags = computeRedFlagsForPerson(EMAIL, records, NOW);
  assert.ok(flags.some(f => f.type === 'late_morning' && f.message.includes('4 días')), JSON.stringify(flags));
});

test('responder Inicio del día antes de las 10:00 am hora CDMX no genera red flag de tardanza', () => {
  // 14:00 UTC == 8:00 am CDMX
  const flags = computeRedFlagsForPerson(EMAIL, [record({ timestamp: '2026-09-21T14:00:00.000Z', qCode: 'BD' })], NOW);
  assert.ok(!flags.some(f => f.type === 'late_morning'), JSON.stringify(flags));
});

test('un solo día activo sin responder Alimentos ni Cierre del día NO genera red flag de faltante (no es un patrón)', () => {
  const flags = computeRedFlagsForPerson(EMAIL, [record({ timestamp: '2026-09-21T14:00:00.000Z', qCode: 'BD' })], NOW);
  assert.ok(!flags.some(f => f.type === 'missing_response'), JSON.stringify(flags));
});

test('saltarse "Cierre del día" en 4 de 5 días activos sí genera red flag de faltante', () => {
  const records = WEEKDAYS_LAST_WEEK.slice(0, 4).map(day => record({ timestamp: `${day}T14:00:00.000Z`, qCode: 'BD' }));
  const flags = computeRedFlagsForPerson(EMAIL, records, NOW);
  assert.ok(
    flags.some(f => f.type === 'missing_response' && f.message.includes('Cierre del día') && f.message.includes('4 días')),
    JSON.stringify(flags),
  );
});

test('completar los 3 slots de un día no genera red flags de faltante ese día', () => {
  const flags = computeRedFlagsForPerson(
    EMAIL,
    [
      record({ timestamp: '2026-09-21T14:00:00.000Z', qCode: 'BD' }),
      record({ timestamp: '2026-09-21T17:00:00.000Z', qCode: 'AL' }),
      record({ timestamp: '2026-09-21T23:00:00.000Z', qCode: 'BT' }),
    ],
    NOW,
  );
  assert.ok(!flags.some(f => f.type === 'missing_response'), JSON.stringify(flags));
});

test('una sola calificación menor a 4 NO genera red flag de calificación baja (no es un patrón)', () => {
  const flags = computeRedFlagsForPerson(EMAIL, [record({ timestamp: '2026-09-21T14:00:00.000Z', qCode: 'BT', rawScore: 2 })], NOW);
  assert.ok(!flags.some(f => f.type === 'low_score'), JSON.stringify(flags));
});

test('calificación menor a 4 en 4 de 5 días sí genera red flag de calificación baja', () => {
  const records = WEEKDAYS_LAST_WEEK.slice(0, 4).map(day => record({ timestamp: `${day}T14:00:00.000Z`, qCode: 'BT', rawScore: 2 }));
  const flags = computeRedFlagsForPerson(EMAIL, records, NOW);
  assert.ok(flags.some(f => f.type === 'low_score' && f.message.includes('2/5') && f.message.includes('4 días')), JSON.stringify(flags));
});

test('Alimentos (AL) se responde con emojis, no con calificación de calidad: un 1/2 ahí nunca es red flag de calificación baja', () => {
  const records = WEEKDAYS_LAST_WEEK.slice(0, 4).flatMap(day => [
    record({ timestamp: `${day}T14:00:00.000Z`, qCode: 'BD', rawScore: 5 }),
    record({ timestamp: `${day}T17:00:00.000Z`, qCode: 'AL', rawScore: 1 }),
    record({ timestamp: `${day}T23:00:00.000Z`, qCode: 'BT', rawScore: 5 }),
  ]);
  const flags = computeRedFlagsForPerson(EMAIL, records, NOW);
  assert.ok(!flags.some(f => f.type === 'low_score'), JSON.stringify(flags));
});

test('una calificación de 4 o más no genera red flag', () => {
  const flags = computeRedFlagsForPerson(
    EMAIL,
    [
      record({ timestamp: '2026-09-21T14:00:00.000Z', qCode: 'BD', rawScore: 4 }),
      record({ timestamp: '2026-09-21T17:00:00.000Z', qCode: 'AL', rawScore: 5 }),
      record({ timestamp: '2026-09-21T23:00:00.000Z', qCode: 'BT', rawScore: 4 }),
    ],
    NOW,
  );
  assert.ok(!flags.some(f => f.type === 'low_score'), JSON.stringify(flags));
});

test('quien está de vacaciones (alcance "all") nunca genera red flags, aunque no haya respondido nada', () => {
  const flags = computeRedFlagsForPerson('emiliano@toroto.mx', [], NOW);
  assert.deepEqual(flags, []);
});

test('una exclusión de alcance solo "VIERNES" (David) no exime de las demás red flags', () => {
  const flags = computeRedFlagsForPerson('david@toroto.mx', [], NOW);
  assert.ok(flags.some(f => f.type === 'silence'), 'David solo está exento de la Encuesta Viernes, no de todo el pulso');
});

test('buildRecommendation sugiere apoyo de RH cuando hay una red flag de severidad alta', () => {
  assert.match(buildRecommendation([{ type: 'low_score', severity: 'alta', message: '' }]), /RH/);
  assert.doesNotMatch(buildRecommendation([{ type: 'missing_response', severity: 'media', message: '' }]), /RH/);
});

test('buildRecommendation distingue silencio repentino (antes constante) de silencio ya sostenido', () => {
  const flags = [{ type: 'silence' as const, severity: 'alta' as const, message: '' }];
  const sudden = buildRecommendation(flags, { wasActiveBeforeSilence: true, priorAvgScore: null, recurringLateMorning: null });
  const chronic = buildRecommendation(flags, { wasActiveBeforeSilence: false, priorAvgScore: null, recurringLateMorning: null });
  assert.notEqual(sudden, chronic);
  assert.match(sudden, /de un día para otro|repentin/);
  assert.match(chronic, /ya venía respondiendo poco/i);
});

test('buildRecommendation menciona la caída repentina de calificación cuando su promedio previo era alto', () => {
  const flags = [{ type: 'low_score' as const, severity: 'alta' as const, message: '' }];
  const rec = buildRecommendation(flags, { wasActiveBeforeSilence: null, priorAvgScore: 4.5, recurringLateMorning: null });
  assert.match(rec, /4\.5\/5/);
  assert.match(rec, /golpe|puntual/);
});

test('buildRecommendation no habla de caída repentina si el promedio previo también era bajo', () => {
  const flags = [{ type: 'low_score' as const, severity: 'alta' as const, message: '' }];
  const rec = buildRecommendation(flags, { wasActiveBeforeSilence: null, priorAvgScore: 3, recurringLateMorning: null });
  assert.doesNotMatch(rec, /golpe/);
  assert.match(rec, /tiempo bajas/);
});

test('buildFlagContext regresa null en todo cuando no hay historial previo a la semana evaluada', () => {
  const context = buildFlagContext([], NOW);
  assert.deepEqual(context, { wasActiveBeforeSilence: null, priorAvgScore: null, recurringLateMorning: null });
});

test('buildFlagContext detecta que la persona sí era activa antes de la semana de silencio', () => {
  // buildFlagContext mira las 3 semanas hábiles previas a "lastWeek" (aquí, hasta el 21 de sept).
  const priorDays = [
    '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',
    '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11',
    '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18',
  ];
  const priorRecords = priorDays.map(day => record({ timestamp: `${day}T14:00:00.000Z`, qCode: 'BD', rawScore: 5 }));
  const context = buildFlagContext(priorRecords, NOW);
  assert.equal(context.wasActiveBeforeSilence, true);
  assert.equal(context.priorAvgScore, 5);
});

test('computeRedFlagsForRoster solo regresa a quienes tienen al menos una red flag, y excluye a quien esté de vacaciones', () => {
  const roster = [
    { email: 'sana@toroto.mx', fullName: 'Sana', team: 'Equipo' },
    { email: 'silenciosa@toroto.mx', fullName: 'Silenciosa', team: 'Equipo' },
    { email: 'emiliano@toroto.mx', fullName: 'Emiliano', team: 'Equipo' },
  ];
  const sanaDays = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
  const records: ResponseRecord[] = sanaDays.flatMap(day => [
    record({ email: 'sana@toroto.mx', timestamp: `${day}T14:00:00.000Z`, qCode: 'BD' }),
    record({ email: 'sana@toroto.mx', timestamp: `${day}T17:00:00.000Z`, qCode: 'AL' }),
    record({ email: 'sana@toroto.mx', timestamp: `${day}T23:00:00.000Z`, qCode: 'BT' }),
  ]);
  // Silenciosa no respondió nada la semana pasada.
  // Emiliano tampoco respondió nada, pero está de vacaciones.
  const result = computeRedFlagsForRoster(roster, records, NOW);
  assert.deepEqual(result.map(p => p.email), ['silenciosa@toroto.mx']);
});
