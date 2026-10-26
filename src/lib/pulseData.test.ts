import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRespuestas, parsePreguntas, currentQuestionFor, isLegacyBdCheckin } from './pulseData.ts';
import type { ResponseRecord } from './pulseData.ts';

function bdRecord(overrides: Partial<ResponseRecord>): ResponseRecord {
  return {
    timestamp: '2026-10-20T15:00:00.000Z',
    responseKey: 'k',
    surveyName: 'Buk',
    qCode: 'BD',
    question: '',
    respondentName: 'Persona',
    email: 'persona@toroto.mx',
    slackUserId: '',
    groups: '',
    roles: '',
    rawScore: null,
    score: null,
    sentiment: '',
    choice: null,
    scheduledDate: '',
    scheduledTime: '',
    ...overrides,
  };
}

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

test('parseRespuestas normaliza el qCode "BUK-E" del check-in de entrada a "BD"', () => {
  const rows = [
    ['timestamps', 'responseKey', 'surveyName', 'qCode', 'question', 'respondentName', 'email', 'slackUserId', 'groups', 'roles', 'rawScore', 'score', 'sentiment', 'choice', 'scheduledDate', 'scheduledTime'],
    ['2026-10-06T15:05:00.000Z', 'k', 'Buk', 'BUK-E', '¿Ya registraste tu entrada en Buk?', 'Andrea', 'andrea@toroto.mx', '', '', '', '', '', '', '1', '2026-10-06', ''],
    ['2026-10-06T15:05:00.000Z', 'k2', 'Buk', 'buk-e', 'q', 'Andrea', 'andrea@toroto.mx', '', '', '', '', '', '', '1', '2026-10-06', ''],
  ];
  const parsed = parseRespuestas(rows);
  assert.equal(parsed[0].qCode, 'BD');
  assert.equal(parsed[1].qCode, 'BD', 'el alias no debe ser sensible a mayúsculas/minúsculas');
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

test('isLegacyBdCheckin: sin choice nunca es el check-in viejo', () => {
  assert.equal(isLegacyBdCheckin(bdRecord({ choice: null, rawScore: 4 })), false);
});

test('isLegacyBdCheckin: con choice y sin texto de pregunta (vacío), se cae de vuelta al check-in viejo', () => {
  assert.equal(isLegacyBdCheckin(bdRecord({ choice: 1, rawScore: 1, question: '' })), true);
});

test('isLegacyBdCheckin: con choice y rawScore poblados pero el texto de la pregunta es la escala nueva, NO es el check-in viejo (bug 2026-10-26)', () => {
  const question = '¿Cómo inicias tu día? 1 = 💀 Con sueño de ultratumba · 2 = 🧟 Como zombi · 5 = 🧹 ¡Con energía de escoba voladora!';
  assert.equal(isLegacyBdCheckin(bdRecord({ choice: 1, rawScore: 1, question })), false);
});

test('isLegacyBdCheckin: con choice y texto que no trae la enumeración 1-5, sigue siendo el check-in viejo', () => {
  assert.equal(isLegacyBdCheckin(bdRecord({ choice: 1, rawScore: 1, question: '¿Ya registraste tu entrada en Buk?' })), true);
});

test('isLegacyBdCheckin: nunca aplica a otros qCodes', () => {
  assert.equal(isLegacyBdCheckin(bdRecord({ qCode: 'BT', choice: 1, rawScore: 1, question: '' })), false);
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
