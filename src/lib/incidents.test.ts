import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIncidentDate, incidentNotesForRange } from './incidents.ts';

test('isIncidentDate reconoce la incidencia del 27/10 solo para Cierre del día (BT)', () => {
  assert.ok(isIncidentDate('2026-10-27', 'BT'));
  assert.ok(isIncidentDate('2026-10-27', 'bt'), 'debe ser insensible a mayúsculas/minúsculas');
  assert.ok(!isIncidentDate('2026-10-27', 'BD'));
  assert.ok(!isIncidentDate('2026-10-26', 'BT'));
});

test('incidentNotesForRange regresa la nota cuando el rango incluye la fecha de la incidencia', () => {
  const notes = incidentNotesForRange(new Date(2026, 9, 26), new Date(2026, 10, 1));
  assert.strictEqual(notes.length, 1);
  assert.match(notes[0], /27\/10/);
});

test('incidentNotesForRange no regresa nada cuando el rango no incluye ninguna incidencia', () => {
  const notes = incidentNotesForRange(new Date(2026, 9, 1), new Date(2026, 9, 26));
  assert.deepStrictEqual(notes, []);
});

test('incidentNotesForRange excluye el día final (ventana [start, end))', () => {
  const notes = incidentNotesForRange(new Date(2026, 9, 20), new Date(2026, 9, 27));
  assert.deepStrictEqual(notes, []);
});
