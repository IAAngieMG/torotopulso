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

test('un líder con acceso ampliado ve su grupo principal + secundarios explícitos, no toda la empresa', () => {
  const access = resolveOrgAccess('alejandro@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.visionGlobal, false);
  assert.equal(access.primaryTeam, 'Dirección de Gestión de Finanzas y Talento');
  assert.deepEqual(access.secondaryTeams, ['Dirección de Operaciones Corporativas', 'RH', 'AYC', 'Administración', 'Contabilidad']);
  assert.deepEqual(scopedTeamNames(access), [
    'Dirección de Gestión de Finanzas y Talento',
    'Dirección de Operaciones Corporativas',
    'RH',
    'AYC',
    'Administración',
    'Contabilidad',
  ]);
});

test('acceso ampliado hace match sin importar mayúsculas en el correo (David)', () => {
  const access = resolveOrgAccess('DAVID@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Dirección de Innovación y Comms');
  assert.deepEqual(access.secondaryTeams, ['Innovación y Tecnología', 'Tecnología de la Información']);
});

test('un líder normal (regla base) ve únicamente el equipo que lidera, sin secundarios', () => {
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

test('Coordinación Territorial de Carbono_Alfredo sin líder asignado no otorga acceso a nadie por ese equipo', () => {
  // Helen lidera "Coordinación Territorial de Carbono_Helen" y es miembro de "_Alfredo", pero
  // "_Alfredo" en sí no tiene líder, así que nadie debería recibir acceso a través de ese puesto.
  const access = resolveOrgAccess('helen@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Coordinación Territorial de Carbono_Helen');
  assert.deepEqual(access.dataScope, ['Coordinación Territorial de Carbono_Helen']);
});
