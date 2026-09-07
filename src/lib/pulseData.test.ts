import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGrupos,
  parseGruposDetalle,
  parseFiltroEspecial,
  parseSlackId,
  parseRespuestas,
  parsePreguntas,
  currentQuestionFor,
  grantsGlobalAccess,
} from './pulseData.ts';

// Filas reales tomadas de "Pulso Toroto tiempo real.xlsx" (recortadas), para blindar el
// parser contra el formato de celdas combinadas real del Sheet, no uno inventado.

const gruposRows = [
  ['DIRECCIÓN', 'PERSONA LÍDER', 'PERSONA COLABORADORA '],
  ['Dirección General ', 'Espinosa De Los Monteros Harispuru Santiago Antonio', 'Garay Olazabal Ane'],
  ['', '', 'Morales Heimlich Alejandro José'],
  ['', '', 'Camhi De La Tejera David'],
  ['', '', ''],
  ['Dirección de Gestión de Finanzas y Talento ', 'Morales Heimlich Alejandro José', 'Gavaldón Eichelmann Daniela'],
  ['', '', 'Ronzon Cruz Valentina'],
  ['', '', ''],
  ['Dirección de Operaciones Corporativas', 'Gavaldón Eichelmann Daniela', 'Mendoza Elizarraras Patricia'],
  ['', '', 'Castro Trujano Jorge Iván'],
];

const gruposDetalleRows = [
  ['GERENCIA DE RESTAURACIÓN TERRITORIAL ', '', ''],
  ['Gerencia de Restauración Territorial ', 'Ortega Arguelles Luis', 'Caceres Ruiz Karen Lizeth'],
  ['', '', 'Schravesande Illescas Ana'],
  ['', '', ''],
  ['DTP de Restauración Territorial ', 'Caceres Ruiz Karen Lizeth', 'Parra Rodríguez Nasly Dayana'],
  ['', '', ''],
  ['OT_Juan', 'Lozano Lázaro Juan', 'Camacho Coronel Xicotencatl'],
  ['', '', 'Gonzalez Barrios Gilberto'],
];

const filtroEspecialRows = [
  ['FILTROS DEL DASHBOARD PARA:', 'PUEDE VER EQUIPOS:'],
  ['Espinosa De Los Monteros Harispuru Santiago Antonio ', 'Dirección General '],
  ['Morales Heimlich Alejandro José', 'Visión global todos los filtros'],
  ['', ''],
  ['Ortega Arguelles Luis', 'Gerencia de Restauración Territorial '],
  ['', 'DTP de Restauración Territorial '],
  ['', 'OT_Juan'],
];

const slackIdRows = [
  ['Slack ID', '', '', 'Nombre de pila'],
  ['D0BA9QL1KB3', 'Ortega Arguelles Luis', 'luis@toroto.mx', 'Luis'],
  ['D0BFPCLM4FQ', 'Caceres Ruiz Karen Lizeth', 'karen@toroto.mx', 'Karen'],
];

test('parseGrupos agrupa por bloque de DIRECCIÓN usando forward-fill', () => {
  const teams = parseGrupos(gruposRows);
  assert.equal(teams.length, 3);
  const direccionGeneral = teams.find(t => t.name === 'Dirección General');
  assert.ok(direccionGeneral);
  assert.equal(direccionGeneral!.leaderName, 'Espinosa De Los Monteros Harispuru Santiago Antonio');
  assert.deepEqual(direccionGeneral!.members, ['Garay Olazabal Ane', 'Morales Heimlich Alejandro José', 'Camhi De La Tejera David']);
});

test('parseGruposDetalle separa encabezados de sección de los sub-equipos reales', () => {
  const subTeams = parseGruposDetalle(gruposDetalleRows);
  const names = subTeams.map(t => t.name);
  assert.ok(!names.includes('GERENCIA DE RESTAURACIÓN TERRITORIAL '), 'el encabezado en mayúsculas no debe tratarse como sub-equipo');
  const gerencia = subTeams.find(t => t.name === 'Gerencia de Restauración Territorial');
  assert.equal(gerencia?.leaderName, 'Ortega Arguelles Luis');
  assert.equal(gerencia?.parentLabel, 'GERENCIA DE RESTAURACIÓN TERRITORIAL');
  const otJuan = subTeams.find(t => t.name === 'OT_Juan');
  assert.deepEqual(otJuan?.members, ['Camacho Coronel Xicotencatl', 'Gonzalez Barrios Gilberto']);
});

test('parseFiltroEspecial arma la lista de equipos visibles por persona', () => {
  const map = parseFiltroEspecial(filtroEspecialRows);
  assert.deepEqual(map.get('Ortega Arguelles Luis'), [
    'Gerencia de Restauración Territorial',
    'DTP de Restauración Territorial',
    'OT_Juan',
  ]);
  assert.ok(grantsGlobalAccess(map.get('Morales Heimlich Alejandro José')!));
});

test('parseSlackId resuelve nombre completo -> correo', () => {
  const { byName, byEmail } = parseSlackId(slackIdRows);
  assert.equal(byName.get('Ortega Arguelles Luis'), 'luis@toroto.mx');
  assert.equal(byEmail.get('karen@toroto.mx'), 'Caceres Ruiz Karen Lizeth');
});

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
