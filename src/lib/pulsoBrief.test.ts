import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPulsoBrief, BRIEF_RANGE_LABELS } from './pulsoBrief.ts';
import type { ResponseRecord } from './pulseData.ts';
import type { OrgAccess } from './orgPermissions.ts';

// Lunes 12 de octubre 2026 -> semana en curso lunes 12 a viernes 16.
const NOW = new Date('2026-10-14T15:00:00.000Z');

function record(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-10-13T15:00:00.000Z',
    responseKey: 'k',
    surveyName: 'BT',
    qCode: 'BT',
    question: 'q',
    respondentName: 'Ane',
    email: 'ane@toroto.mx',
    slackUserId: '',
    groups: '',
    roles: '',
    rawScore: 4,
    score: 8,
    sentiment: '',
    choice: null,
    scheduledDate: '',
    scheduledTime: '',
    ...overrides,
  };
}

const scopedAccess: OrgAccess = {
  granted: true,
  fullName: 'Test Leader',
  visionGlobal: false,
  primaryTeam: 'Dirección General',
  secondaryTeams: [],
  dataScope: ['Dirección General'],
};

test('arma un brief con encabezado, KPIs y la sección por equipo para el alcance dado', () => {
  const md = buildPulsoBrief({
    access: scopedAccess,
    email: 'santiago@toroto.mx',
    allRecords: [record({})],
    range: 'week',
    now: NOW,
  });
  assert.ok(md.includes(`# Brief de Pulso Toroto — ${BRIEF_RANGE_LABELS.week}`));
  assert.ok(md.includes('## Resumen general'));
  assert.ok(md.includes('## Por equipo'));
  assert.ok(md.includes('Dirección General'));
  assert.ok(md.includes('## Alertas'));
});

test('una cuenta sin equipos en su alcance arma el brief sin reventar', () => {
  const emptyAccess: OrgAccess = { ...scopedAccess, primaryTeam: null, dataScope: [] };
  const md = buildPulsoBrief({ access: emptyAccess, email: 'nadie@toroto.mx', allRecords: [], range: 'month', now: NOW });
  assert.ok(md.includes('Sin equipos en el alcance de esta cuenta.'));
});
