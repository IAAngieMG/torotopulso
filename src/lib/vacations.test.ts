import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeVacation, isExcludedFromSignal, filterVacationingEmails, vacationLabel } from './vacations.ts';

test('Emiliano está de vacaciones (todo signal) hasta el 5 de octubre 2026', () => {
  const before = new Date('2026-09-28T15:00:00.000Z');
  const active = activeVacation('emiliano@toroto.mx', before);
  assert.ok(active, 'debe estar de vacaciones');
  assert.equal(active!.scope, 'all');
  assert.match(vacationLabel(active!), /vacaciones/i);
  assert.match(vacationLabel(active!), /5 de octubre/);

  assert.ok(isExcludedFromSignal('emiliano@toroto.mx', 'BD', before));
  assert.ok(isExcludedFromSignal('emiliano@toroto.mx', 'VIERNES', before));
});

test('Emiliano deja de estar de vacaciones después del 5 de octubre', () => {
  const after = new Date('2026-10-06T12:00:00.000Z');
  assert.equal(activeVacation('emiliano@toroto.mx', after), null);
  assert.equal(isExcludedFromSignal('emiliano@toroto.mx', 'BD', after), false);
});

test('David solo se excluye de la Encuesta Viernes hasta el 26 de octubre, no de BD/AL/BT', () => {
  const now = new Date('2026-09-28T15:00:00.000Z');
  assert.equal(isExcludedFromSignal('david@toroto.mx', 'BD', now), false);
  assert.equal(isExcludedFromSignal('david@toroto.mx', 'AL', now), false);
  assert.equal(isExcludedFromSignal('david@toroto.mx', 'BT', now), false);
  assert.ok(isExcludedFromSignal('david@toroto.mx', 'VIERNES', now));
});

test('quien no tiene periodo registrado nunca se excluye', () => {
  assert.equal(activeVacation('karen@toroto.mx'), null);
  assert.equal(isExcludedFromSignal('karen@toroto.mx', 'VIERNES'), false);
});

test('filterVacationingEmails quita solo a quien corresponde según el signal', () => {
  const now = new Date('2026-09-28T15:00:00.000Z');
  const emails = ['david@toroto.mx', 'emiliano@toroto.mx', 'karen@toroto.mx'];
  assert.deepEqual(filterVacationingEmails(emails, 'VIERNES', now), ['karen@toroto.mx']);
  assert.deepEqual(filterVacationingEmails(emails, 'BD', now), ['david@toroto.mx', 'karen@toroto.mx']);
});
