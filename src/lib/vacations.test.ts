import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeVacation, isExcludedFromSignal, filterVacationingEmails, vacationLabel, isPersonOff } from './vacations.ts';

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

test('David está en off (todo signal) del 5 al 31 de octubre 2026, no antes', () => {
  const before = new Date('2026-09-28T15:00:00.000Z');
  assert.equal(activeVacation('david@toroto.mx', before), null);
  assert.equal(isExcludedFromSignal('david@toroto.mx', 'BD', before), false);
  assert.equal(isExcludedFromSignal('david@toroto.mx', 'VIERNES', before), false);

  const during = new Date('2026-10-15T15:00:00.000Z');
  const active = activeVacation('david@toroto.mx', during);
  assert.ok(active, 'debe estar en off');
  assert.equal(active!.scope, 'all');
  assert.ok(isExcludedFromSignal('david@toroto.mx', 'BD', during));
  assert.ok(isExcludedFromSignal('david@toroto.mx', 'AL', during));
  assert.ok(isExcludedFromSignal('david@toroto.mx', 'BT', during));
  assert.ok(isExcludedFromSignal('david@toroto.mx', 'VIERNES', during));

  const after = new Date('2026-11-01T15:00:00.000Z');
  assert.equal(activeVacation('david@toroto.mx', after), null);
});

test('isPersonOff es true durante un período "En off" y false fuera de rango', () => {
  assert.ok(isPersonOff('octabio@toroto.mx', new Date('2026-10-25T15:00:00.000Z')));
  assert.equal(isPersonOff('octabio@toroto.mx', new Date('2026-10-27T15:00:00.000Z')), false);
  assert.ok(isPersonOff('renan@toroto.mx', new Date('2026-10-28T15:00:00.000Z')));
  assert.equal(isPersonOff('renan@toroto.mx', new Date('2026-10-24T15:00:00.000Z')), false);
  assert.ok(isPersonOff('karla@toroto.mx', new Date('2026-11-11T15:00:00.000Z')));
});

test('Karla además tiene vacaciones normales del 21 de diciembre al 3 de enero, aparte de su "En off" de noviembre', () => {
  assert.equal(isPersonOff('karla@toroto.mx', new Date('2026-11-20T15:00:00.000Z')), false);
  const active = activeVacation('karla@toroto.mx', new Date('2026-12-25T15:00:00.000Z'));
  assert.ok(active);
  assert.equal(active!.reason, 'De vacaciones');
  assert.match(vacationLabel(active!), /vacaciones/i);
  assert.ok(isPersonOff('karla@toroto.mx', new Date('2027-01-03T15:00:00.000Z')), 'sigue de vacaciones hasta el 3 de enero, no solo hasta el 31 de diciembre');
  assert.equal(isPersonOff('karla@toroto.mx', new Date('2027-01-04T15:00:00.000Z')), false);
});

test('Ane está de maternidad (todo signal) hasta el 8 de febrero de 2027', () => {
  const now = new Date('2026-10-09T15:00:00.000Z');
  const active = activeVacation('ane@toroto.mx', now);
  assert.ok(active, 'debe estar de maternidad');
  assert.equal(active!.scope, 'all');
  assert.match(vacationLabel(active!), /maternidad/i);
  assert.match(vacationLabel(active!), /8 de febrero/);
  assert.ok(isExcludedFromSignal('ane@toroto.mx', 'BD', now));
});

test('quien no tiene periodo registrado nunca se excluye', () => {
  // Fecha fija (no "ahora"): karen@toroto.mx sí tiene un período "En off" registrado más adelante
  // (ver VACATIONS), así que esta prueba usa a alguien sin ningún período y una fecha explícita,
  // para no quedar atada a si hoy cae o no dentro de un período que se agregue después.
  const now = new Date('2026-09-20T15:00:00.000Z');
  assert.equal(activeVacation('juan@toroto.mx', now), null);
  assert.equal(isExcludedFromSignal('juan@toroto.mx', 'VIERNES', now), false);
});

test('filterVacationingEmails quita solo a quien corresponde según el signal y la fecha', () => {
  const now = new Date('2026-09-28T15:00:00.000Z');
  const emails = ['david@toroto.mx', 'emiliano@toroto.mx', 'karen@toroto.mx'];
  // Antes del 5 de octubre, David aún no está de vacaciones.
  assert.deepEqual(filterVacationingEmails(emails, 'VIERNES', now), ['david@toroto.mx', 'karen@toroto.mx']);
  assert.deepEqual(filterVacationingEmails(emails, 'BD', now), ['david@toroto.mx', 'karen@toroto.mx']);

  // El 15 de octubre, David sigue de vacaciones pero Emiliano ya no (la suya terminó el 5).
  const during = new Date('2026-10-15T15:00:00.000Z');
  assert.deepEqual(filterVacationingEmails(emails, 'VIERNES', during), ['emiliano@toroto.mx', 'karen@toroto.mx']);
  assert.deepEqual(filterVacationingEmails(emails, 'BD', during), ['emiliano@toroto.mx', 'karen@toroto.mx']);
});

test('Angie (ti@toroto.mx) tiene vacaciones el 4 y el 7 de diciembre, y del 22 de diciembre al 3 de enero', () => {
  assert.ok(isPersonOff('ti@toroto.mx', new Date('2026-12-04T15:00:00.000Z')), 'viernes 4 de diciembre');
  assert.ok(isPersonOff('ti@toroto.mx', new Date('2026-12-07T15:00:00.000Z')), 'lunes 7 de diciembre (el fin de semana de por medio no importa: nadie espera respuesta sábado/domingo)');
  assert.equal(isPersonOff('ti@toroto.mx', new Date('2026-12-08T15:00:00.000Z')), false, 'ya de vuelta el 8 de diciembre');

  assert.equal(isPersonOff('ti@toroto.mx', new Date('2026-12-21T15:00:00.000Z')), false, 'todavía no, un día antes de su segundo período');
  assert.ok(isPersonOff('ti@toroto.mx', new Date('2026-12-22T15:00:00.000Z')), 'último día de Pulso del año, Angie ya está de vacaciones');
  assert.ok(isPersonOff('ti@toroto.mx', new Date('2027-01-03T15:00:00.000Z')));
  assert.equal(isPersonOff('ti@toroto.mx', new Date('2027-01-04T15:00:00.000Z')), false, 'de vuelta el 4 de enero, con todos los demás');
});
