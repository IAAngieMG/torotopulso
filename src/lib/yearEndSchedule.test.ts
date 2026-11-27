import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isHolidayNoSurveyDate, isSkippedViernesDate, isSlotSwappedAway } from './yearEndSchedule.ts';

test('isHolidayNoSurveyDate solo marca el 16 de noviembre de 2026', () => {
  assert.equal(isHolidayNoSurveyDate('2026-11-16'), true);
  assert.equal(isHolidayNoSurveyDate('2026-11-17'), false);
  assert.equal(isHolidayNoSurveyDate('2026-11-09'), false);
});

test('isSkippedViernesDate marca el tercer viernes del mes, salvo excepción explícita', () => {
  // Noviembre 2026: viernes 6, 13, 20, 27 -> el tercero es el 20.
  assert.equal(isSkippedViernesDate('2026-11-20'), true);
  assert.equal(isSkippedViernesDate('2026-11-06'), false);
  assert.equal(isSkippedViernesDate('2026-11-13'), false);
  assert.equal(isSkippedViernesDate('2026-11-27'), false);
  // Diciembre 2026: el 18 es tercer viernes, pero ese día sí hubo encuesta (CA3).
  assert.equal(isSkippedViernesDate('2026-12-18'), false, 'el 18 de diciembre de 2026 sí tuvo encuesta (CA3)');
  assert.equal(isSkippedViernesDate('2026-12-04'), false);
  assert.equal(isSkippedViernesDate('2026-12-11'), false);
});

test('isSlotSwappedAway marca BT->FIESTAS el 22 de diciembre de 2026, y solo ese slot/fecha', () => {
  assert.equal(isSlotSwappedAway('2026-12-22', 'BT'), true);
  assert.equal(isSlotSwappedAway('2026-12-22', 'bt'), true, 'insensible a mayúsculas');
  assert.equal(isSlotSwappedAway('2026-12-22', 'BD'), false);
  assert.equal(isSlotSwappedAway('2026-12-21', 'BT'), false);
});
