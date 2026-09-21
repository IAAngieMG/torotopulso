import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrgAccess, scopedTeamNames, allViewAsTargets } from './orgPermissions.ts';
import { allTeamNames } from './orgChart.ts';

test('los 4 correos de visión global ven todos los equipos, aunque no lideren ninguna DIRECCIÓN', () => {
  for (const email of ['santiago@toroto.mx', 'ti@toroto.mx', 'patricia@toroto.mx', 'karla@toroto.mx']) {
    const access = resolveOrgAccess(email);
    assert.equal(access.granted, true, email);
    assert.equal(access.visionGlobal, true, email);
    assert.equal(access.dataScope, 'all', email);
    assert.deepEqual(scopedTeamNames(access), allTeamNames(), email);
  }
});

test('Karla (visión global, no lidera equipo) toma su equipo de membresía como "Mi equipo"', () => {
  assert.equal(resolveOrgAccess('karla@toroto.mx').primaryTeam, 'RH');
  assert.equal(resolveOrgAccess('ti@toroto.mx').primaryTeam, 'Dirección de Innovación y Comms');
});

test('Samantha ya no tiene visión global: solo ve el pulso de RH (acceso restringido, sin liderarlo)', () => {
  const access = resolveOrgAccess('samantha@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.visionGlobal, false);
  assert.equal(access.primaryTeam, 'RH');
  assert.deepEqual(access.secondaryTeams, []);
  assert.deepEqual(access.dataScope, ['RH']);
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

test('Luis lidera dos equipos (Gerencia de Restauración Territorial y _Alfredo) y su cascada une ambos, llegando hasta Helen', () => {
  // "_Alfredo" quedó sin líder asignado y le pasó a Luis, así que ahora sí es alcanzable, y desde
  // ahí la cascada sigue hasta "_Helen" (que Helen lidera, siendo miembro de "_Alfredo").
  const access = resolveOrgAccess('luis@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Gerencia de Restauración Territorial');
  assert.deepEqual(
    new Set(access.secondaryTeams),
    new Set([
      'DTP de Restauración Territorial',
      'OT_Juan',
      'Coordinación Territorial de Carbono_Xico',
      'Coordinación Territorial de Carbono_Alfredo',
      'Coordinación Territorial de Carbono_Helen',
    ]),
  );
});

test('Helen (miembro de _Alfredo, que ahora lidera Luis) sigue liderando su propio equipo con su propio alcance', () => {
  const access = resolveOrgAccess('helen@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Coordinación Territorial de Carbono_Helen');
  assert.deepEqual(access.dataScope, ['Coordinación Territorial de Carbono_Helen']);
});

test('Sofia llega hasta Eleazar: su cascada desde Dirección P3 incluye P3', () => {
  const access = resolveOrgAccess('sofiasalas@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Dirección P3');
  assert.deepEqual(access.secondaryTeams, ['P3']);
});

test('Armando ya no está en Toroto: sus reportes (Mario, Miguel, Diana) suben a reportar directo a José y siguen alcanzables', () => {
  const access = resolveOrgAccess('jose@toroto.mx');
  assert.equal(access.granted, true);
  assert.equal(access.primaryTeam, 'Dirección de Carbono');
  // Mario ahora es miembro directo de "Dirección de Carbono" y sigue liderando su propio equipo,
  // así que la cascada de José debe seguir llegando hasta "Coordinación Territorial de Carbono_Mario".
  assert.ok(access.secondaryTeams.includes('Coordinación Territorial de Carbono_Mario'));
  assert.ok(!access.secondaryTeams.includes('Gestión de Proyectos_Armando'));
});

test('Armando ya no tiene acceso (ya no está en el organigrama)', () => {
  const access = resolveOrgAccess('armando@toroto.mx');
  assert.equal(access.granted, false);
});

test('allViewAsTargets incluye a todo líder y perfil con acceso otorgado, no una lista fija', () => {
  const targets = allViewAsTargets(['ti@toroto.mx']);
  const emails = targets.map(t => t.email);
  assert.ok(emails.includes('samantha@toroto.mx'), 'Samantha (acceso restringido) debe poder simularse');
  assert.ok(emails.includes('sofiasalas@toroto.mx'), 'cualquier líder, no solo la lista fija anterior, debe estar disponible');
  assert.ok(emails.includes('luis@toroto.mx'));
  assert.ok(!emails.includes('ti@toroto.mx'), 'no debe incluirse a quien está viendo la lista');
  assert.ok(!emails.includes('ana@toroto.mx'), 'quien no tiene acceso otorgado no debe aparecer como destino de "Ver como"');
});
