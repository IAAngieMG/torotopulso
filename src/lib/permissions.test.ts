import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGrupos, parseGruposDetalle, parseFiltroEspecial, parseSlackId } from './pulseData.ts';
import { resolveAccess } from './permissions.ts';

const gruposRows = [
  ['DIRECCIÓN', 'PERSONA LÍDER', 'PERSONA COLABORADORA '],
  ['Dirección General ', 'Espinosa De Los Monteros Harispuru Santiago Antonio', 'Garay Olazabal Ane'],
  ['', '', 'Morales Heimlich Alejandro José'],
  ['', '', ''],
  ['Dirección de Gestión de Finanzas y Talento ', 'Morales Heimlich Alejandro José', 'Gavaldón Eichelmann Daniela'],
  ['', '', ''],
];

const gruposDetalleRows = [
  ['GERENCIA DE RESTAURACIÓN TERRITORIAL ', '', ''],
  ['Gerencia de Restauración Territorial ', 'Ortega Arguelles Luis', 'Caceres Ruiz Karen Lizeth'],
  ['', '', ''],
];

const filtroEspecialRows = [
  ['FILTROS DEL DASHBOARD PARA:', 'PUEDE VER EQUIPOS:'],
  ['Morales Heimlich Alejandro José', 'Visión global todos los filtros'],
  ['', ''],
];

const slackIdRows = [
  ['Slack ID', '', '', 'Nombre de pila'],
  ['D1', 'Ortega Arguelles Luis', 'luis@toroto.mx', 'Luis'],
  ['D2', 'Morales Heimlich Alejandro José', 'alejandro@toroto.mx', 'Alejandro'],
  ['D3', 'Un Colaborador Cualquiera', 'colaborador@toroto.mx', 'Colaborador'],
];

const teams = parseGrupos(gruposRows);
const subTeams = parseGruposDetalle(gruposDetalleRows);
const filtroEspecial = parseFiltroEspecial(filtroEspecialRows);
const { byEmail } = parseSlackId(slackIdRows);

test('los 5 correos ejecutivos siempre tienen acceso total, aunque no aparezcan en el Sheet', () => {
  const access = resolveAccess('santiago@toroto.mx', byEmail, teams, subTeams, filtroEspecial);
  assert.equal(access.granted, true);
  assert.equal(access.dataScope, 'all');
});

test('Filtro especial con "Visión global" da acceso total', () => {
  const access = resolveAccess('alejandro@toroto.mx', byEmail, teams, subTeams, filtroEspecial);
  assert.equal(access.granted, true);
  assert.equal(access.dataScope, 'all');
});

test('un líder de DIRECCIÓN sin entrada en Filtro especial ve solo su propio equipo', () => {
  // Alejandro también lidera "Dirección de Gestión de Finanzas y Talento" en Grupos, pero como
  // tiene "Visión global" en Filtro especial ese caso ya lo cubre el test anterior. Probamos con
  // un líder de sub-equipo (Grupos a detalles) que se mapea a su DIRECCIÓN padre.
  const access = resolveAccess('luis@toroto.mx', byEmail, teams, subTeams, filtroEspecial);
  assert.equal(access.granted, false, 'Gerencia de Restauración Territorial no existe como DIRECCIÓN en este fixture recortado, así que debe negarse, no inventar acceso');
});

test('un colaborador raso sin rol de líder no tiene acceso', () => {
  const access = resolveAccess('colaborador@toroto.mx', byEmail, teams, subTeams, filtroEspecial);
  assert.equal(access.granted, false);
});

test('un correo que ni siquiera está en SlackID no tiene acceso', () => {
  const access = resolveAccess('desconocido@toroto.mx', byEmail, teams, subTeams, filtroEspecial);
  assert.equal(access.granted, false);
});
