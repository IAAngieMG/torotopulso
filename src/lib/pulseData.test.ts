import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRespuestas, parsePreguntas, currentQuestionFor } from './pulseData.ts';

test('parseRespuestas castea scores numéricos y deja email en minúsculas', () => {
  const rows = [
    ['timestamps', 'responseKey', 'surveyName', 'qCode', 'question', 'respondentName', 'email', 'slackUserId', 'groups', 'roles', 'rawScore', 'score', 'sentiment', 'choice', 'scheduledDate', 'scheduledTime'],
    ['2026-08-31T20:00:36.195Z', 'k', 'Alimentos', 'AL', 'q', 'Jiménez Ocampo Adrián', 'Santiago.Jimenez@toroto.mx', 'U1', '', '', '2', '4', 'positivo', '2', '2026-08-31T06:00:36.000Z', ''],
  ];
  const parsed = parseRespuestas(rows);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].email, 'santiago.jimenez@toroto.mx');
  assert.equal(parsed[0].score, 4);
  assert.equal(parsed[0].choice, 2);
});

test('parseRespuestas mantiene "BUK-E" (check-in de entrada en Buk) como su propio qCode, distinto de "BD" (Inicio del día), normalizando solo mayúsculas/minúsculas', () => {
  // BUK-E y BD son dos encuestas concurrentes y genuinamente distintas, no formatos viejo/nuevo
  // de la misma pregunta — ver pulseData.ts. Mezclarlas (como hacía un alias previo) rompía toda
  // detección de "cuál es cuál" río abajo.
  const rows = [
    ['timestamps', 'responseKey', 'surveyName', 'qCode', 'question', 'respondentName', 'email', 'slackUserId', 'groups', 'roles', 'rawScore', 'score', 'sentiment', 'choice', 'scheduledDate', 'scheduledTime'],
    ['2026-10-06T15:05:00.000Z', 'k', 'Buk', 'BUK-E', '¿Ya registraste tu entrada en Buk?', 'Andrea', 'andrea@toroto.mx', '', '', '', '', '', '', '1', '2026-10-06', ''],
    ['2026-10-06T15:05:00.000Z', 'k2', 'Buk', 'buk-e', 'q', 'Andrea', 'andrea@toroto.mx', '', '', '', '', '', '', '1', '2026-10-06', ''],
  ];
  const parsed = parseRespuestas(rows);
  assert.equal(parsed[0].qCode, 'BUK-E');
  assert.equal(parsed[1].qCode, 'BUK-E', 'el qCode se normaliza a mayúsculas, sin importar cómo venga en el Sheet');
});

test('currentQuestionFor rota el pool de Viernes y respeta el mes para BD/AL/BT', () => {
  const templates = [
    { mes: '', slot: 'VIERNES', mensaje: 'Pregunta viernes A' },
    { mes: '', slot: 'VIERNES', mensaje: 'Pregunta viernes B' },
    { mes: 'Septiembre', slot: 'BD', mensaje: 'Pregunta BD septiembre' },
    { mes: 'Octubre', slot: 'BD', mensaje: 'Pregunta BD octubre (halloween)' },
  ];
  assert.equal(currentQuestionFor(templates, 'BD', new Date('2026-09-15')), 'Pregunta BD septiembre');
  assert.equal(currentQuestionFor(templates, 'BD', new Date('2026-10-15')), 'Pregunta BD octubre (halloween)');
  const viernesAnswer = currentQuestionFor(templates, 'VIERNES', new Date('2026-09-04'));
  assert.ok(['Pregunta viernes A', 'Pregunta viernes B'].includes(viernesAnswer));
});

test('parsePreguntas ignora filas sin mensaje', () => {
  const rows = [
    ['Mes', 'Slot', 'DiaMin', 'DiaMax', 'Mensaje / Pregunta'],
    ['', 'VIERNES', '', '', 'Pregunta real'],
    ['', '', '', '', ''],
  ];
  const templates = parsePreguntas(rows);
  assert.equal(templates.length, 1);
  assert.equal(templates[0].mensaje, 'Pregunta real');
});
