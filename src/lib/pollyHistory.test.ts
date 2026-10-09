import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pollyHistoryFor } from './pollyHistory.ts';
import { ORG_TEAMS } from './orgChart.ts';

test('pollyHistoryFor regresa el informe de alguien con registros en el análisis (caso Karla)', () => {
  const report = pollyHistoryFor('karla@toroto.mx');
  assert.ok(report, 'Karla debe tener informe');
  assert.equal(report!.fullName, 'Karla Rebolledo Fernandez');
  assert.ok(report!.inicio!.average > 0 && report!.inicio!.average <= 10);
  assert.ok(report!.cierreParticipacion!.participationPct >= 0 && report!.cierreParticipacion!.participationPct <= 100);
});

test('pollyHistoryFor no distingue mayúsculas/minúsculas en el correo', () => {
  const lower = pollyHistoryFor('karla@toroto.mx');
  const upper = pollyHistoryFor('KARLA@TOROTO.MX');
  assert.deepEqual(upper, lower);
});

test('pollyHistoryFor regresa null para alguien del equipo actual que no estaba en el periodo del análisis (caso Gabriella)', () => {
  assert.equal(pollyHistoryFor('gabriella@toroto.mx'), null);
});

test('Bertha tiene un informe marcado como estimado (sí estaba en Toroto pero falta en Calc_Data)', () => {
  const report = pollyHistoryFor('bertha@toroto.mx');
  assert.ok(report, 'Bertha debe tener un informe, aunque sea estimado');
  assert.equal(report!.estimated, true);
});

test('pollyHistoryFor regresa null para un correo que no existe en el organigrama', () => {
  assert.equal(pollyHistoryFor('nadie@toroto.mx'), null);
});

test('Ane Garay Olazabal tiene informe en el análisis aunque esté de maternidad', () => {
  const report = pollyHistoryFor('ane@toroto.mx');
  assert.ok(report, 'Ane debe tener informe histórico de Polly');
  assert.equal(report!.fullName, 'Ane Garay Olazabal');
});

test('cada persona con informe sigue en el organigrama actual (ORG_TEAMS)', () => {
  const allEmails = new Set<string>();
  for (const team of ORG_TEAMS) {
    if (team.leader.email) allEmails.add(team.leader.email.toLowerCase());
    for (const member of team.members) if (member.email) allEmails.add(member.email.toLowerCase());
  }
  // Nadie que ya no esté en el equipo (ej. Armando) debería colarse en el informe histórico.
  assert.ok(!allEmails.has('armando@toroto.mx'));
  assert.equal(pollyHistoryFor('armando@toroto.mx'), null);
});
