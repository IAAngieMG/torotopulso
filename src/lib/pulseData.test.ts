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
