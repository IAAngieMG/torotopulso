import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrgAccess, scopedTeamNames } from './orgPermissions.ts';
import { allTeamNames } from './orgChart.ts';

test('los 5 correos de visión global ven todos los equipos, aunque no lideren ninguna DIRECCIÓN', () => {
  for (const email of ['santiago@toroto.mx', 'ti@toroto.mx', 'patricia@toroto.mx', 'samantha@toroto.mx', 'karla@toroto.mx']) {
    const access = resolveOrgAccess(email);
    assert.equal(access.granted, true, email);
    assert.equal(access.visionGlobal, true, email);
    assert.equal(access.dataScope, 'all', email);
    assert.deepEqual(scopedTeamNames(access), allTeamNames(), email);
  }
});

test('Karla y Samantha (visión global, no lideran equipo) toman su equipo de membresía como "Mi equipo"', () => {
  assert.equal(resolveOrgAccess('karla@toroto.mx').primaryTeam, 'RH');
  assert.equal(resolveOrgAccess('samantha@toroto.mx').primaryTeam, 'RH');
  assert.equal(resolveOrgAccess('ti@toroto.mx').primaryTeam, 'Dirección de Innovación y Comms');
});

test('el "General" de un líder se calcula en cascada, no de una lista fija (ejemplo de validación: Iván/AYC)', () => {
  const access = resolveOrgAccess('ivancastro@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.visionGlobal, false);
  assert.equal(access.primaryTeam, 'AYC');
  // AYC (Raúl, Iris, Aretha) -> Raúl lidera Contabilidad, Iris lidera Administración.
  assert.deepEqual(access.secondaryTeams, ['Contabilidad', 'Administración']);
  assert.deepEqual(scopedTeamNames(access), ['AYC', 'Contabilidad', 'Administración']);
});

test('la cascada sigue varios niveles de profundidad (Alejandro: sus reportes lideran equipos cuyos miembros a su vez lideran otros)', () => {
  const access = resolveOrgAccess('alejandro@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Dirección de Gestión de Finanzas y Talento');
  assert.deepEqual(access.secondaryTeams, [
    'Dirección de Operaciones Corporativas',
    'Análisis y Planeación Financiera',
    'RH',
    'AYC',
    'Contabilidad',
    'Administración',
  ]);
});

test('la cascada hace match sin importar mayúsculas en el correo (David)', () => {
  const access = resolveOrgAccess('DAVID@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Dirección de Innovación y Comms');
  assert.deepEqual(access.secondaryTeams, ['Innovación y Tecnología', 'Tecnología de la Información']);
});

test('un líder sin reportes que a su vez lideren otro equipo no tiene secundarios (caso base)', () => {
  const access = resolveOrgAccess('karen@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.visionGlobal, false);
  assert.equal(access.primaryTeam, 'DTP de Restauración Territorial');
  assert.deepEqual(access.secondaryTeams, []);
  assert.deepEqual(scopedTeamNames(access), ['DTP de Restauración Territorial']);
});

test('un colaborador que no lidera ningún equipo y no está en las listas especiales no tiene acceso', () => {
  const access = resolveOrgAccess('ana@toroto.mx');
  assert.equal(access.granted, false);
});

test('un correo que no existe en el organigrama no tiene acceso', () => {
  const access = resolveOrgAccess('nadie@toroto.mx');
  assert.equal(access.granted, false);
  assert.equal(access.fullName, '');
});

test('la cascada no puede cruzar un equipo sin líder asignado (Luis no llega a _Alfredo ni a _Helen)', () => {
  // OT_Juan -> Xicotencatl lidera _Xico, pero nadie lidera "_Alfredo" (así que Helen, que lo
  // lidera... no: Helen lidera "_Helen", pero es MIEMBRO de "_Alfredo", que no tiene líder). Como
  // ningún miembro alcanzable desde Luis lidera "_Alfredo", la cascada nunca descubre a Helen ni,
  // por lo tanto, "_Helen" tampoco entra al alcance de Luis.
  const access = resolveOrgAccess('luis@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Gerencia de Restauración Territorial');
  assert.deepEqual(access.secondaryTeams, ['DTP de Restauración Territorial', 'OT_Juan', 'Coordinación Territorial de Carbono_Xico']);
  assert.ok(!access.secondaryTeams.includes('Coordinación Territorial de Carbono_Alfredo'));
  assert.ok(!access.secondaryTeams.includes('Coordinación Territorial de Carbono_Helen'));
});

test('Coordinación Territorial de Carbono_Alfredo sin líder asignado no otorga acceso a nadie por ese equipo', () => {
  // Helen lidera "Coordinación Territorial de Carbono_Helen" y es miembro de "_Alfredo", pero
  // "_Alfredo" en sí no tiene líder, así que nadie debería recibir acceso a través de ese puesto.
  const access = resolveOrgAccess('helen@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Coordinación Territorial de Carbono_Helen');
  assert.deepEqual(access.dataScope, ['Coordinación Territorial de Carbono_Helen']);
});
