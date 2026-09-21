import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rosterForTeams } from './orgChart.ts';

test('rosterForTeams no duplica a quien lidera un equipo y es miembro de otro dentro del mismo alcance (caso Karen)', () => {
  // Karen es miembro de "Gerencia de Restauración Territorial" (que lidera Luis) y a la vez
  // lidera "DTP de Restauración Territorial" — ambos equipos están en el alcance de Luis.
  const roster = rosterForTeams(['Gerencia de Restauración Territorial', 'DTP de Restauración Territorial']);
  const karenEntries = roster.filter(p => p.email === 'karen@toroto.mx');
  assert.equal(karenEntries.length, 1, 'Karen debe aparecer una sola vez');
  assert.equal(karenEntries[0].isLeader, true, 'debe aparecer bajo el equipo que lidera, no como simple miembro');
  assert.equal(karenEntries[0].team, 'DTP de Restauración Territorial');
});

test('rosterForTeams: nadie se repite en un alcance con varios niveles de cascada (caso Luis completo)', () => {
  const teams = [
    'Gerencia de Restauración Territorial',
    'DTP de Restauración Territorial',
    'OT_Juan',
    'Coordinación Territorial de Carbono_Xico',
    'Coordinación Territorial de Carbono_Alfredo',
    'Coordinación Territorial de Carbono_Helen',
  ];
  const roster = rosterForTeams(teams);
  const emails = roster.map(p => p.email);
  assert.equal(new Set(emails).size, emails.length, 'no debe haber correos repetidos');
});

test('rosterForTeams con onlyLeaders solo regresa líderes, uno por persona', () => {
  const roster = rosterForTeams(['Gerencia de Restauración Territorial', 'DTP de Restauración Territorial'], { onlyLeaders: true });
  assert.deepEqual(
    roster.map(p => p.email).sort(),
    ['karen@toroto.mx', 'luis@toroto.mx'].sort(),
  );
  assert.ok(roster.every(p => p.isLeader));
});

test('rosterForTeams con excludeEmail quita a esa persona del resultado', () => {
  const roster = rosterForTeams(['Gerencia de Restauración Territorial'], { excludeEmail: 'luis@toroto.mx' });
  assert.ok(!roster.some(p => p.email === 'luis@toroto.mx'));
  assert.ok(roster.some(p => p.email === 'karen@toroto.mx'));
});
