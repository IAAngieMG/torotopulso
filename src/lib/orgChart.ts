/**
 * Organigrama de Toroto para Pulso Toroto: equipos, líderes y miembros, con su correo cuando
 * ya se les asignó uno. Es la fuente de verdad para permisos y roster — reemplaza la lectura
 * dinámica de las hojas `Grupos` / `Grupos a detalles` / `Filtro especial` / `SlackID`, que
 * dependía de que los nombres coincidieran exactamente entre hojas mantenidas a mano.
 * `Respuestas` y `Preguntas` siguen viniendo en vivo del Sheet — esto es solo la jerarquía.
 */
export interface OrgMember {
  name: string;
  email: string | null;
}

export interface OrgTeam {
  name: string;
  leader: OrgMember;
  members: OrgMember[];
}

const m = (name: string, email: string | null): OrgMember => ({ name, email: email ? email.toLowerCase() : null });

export const ORG_TEAMS: OrgTeam[] = [
  {
    name: 'Dirección General',
    leader: m('Santiago Espinosa Harispuru', 'santiago@toroto.mx'),
    members: [
      m('Ane Garay Olazabal', null),
      m('Alejandro Morales Heimlich', 'alejandro@toroto.mx'),
      m('David Camhi De La Tejera', 'David@toroto.mx'),
      m('Sofia Salas Ungar', 'sofiasalas@toroto.mx'),
      m('José Reyes Sanchez-Cutillas', 'jose@toroto.mx'),
      m('Luis Ortega Arguelles', 'luis@toroto.mx'),
    ],
  },
  {
    name: 'Dirección de Gestión de Finanzas y Talento',
    leader: m('Alejandro Morales Heimlich', 'alejandro@toroto.mx'),
    members: [m('Daniela Gavaldón Eichelmann', 'dgavaldon@toroto.mx'), m('Valentina Ronzon Cruz', 'valentina@toroto.mx')],
  },
  {
    name: 'Análisis y Planeación Financiera',
    leader: m('Valentina Ronzon Cruz', 'valentina@toroto.mx'),
    members: [m('María José Moranchel Sánchez', 'mariajose@toroto.mx')],
  },
  {
    name: 'Dirección de Operaciones Corporativas',
    leader: m('Daniela Gavaldón Eichelmann', 'dgavaldon@toroto.mx'),
    members: [
      m('Patricia Mendoza Elizarraras', 'patricia@toroto.mx'),
      m('Iván Castro Trujano', 'ivancastro@toroto.mx'),
      m('Lourdes Montejo Montejo', 'lourdes@toroto.mx'),
    ],
  },
  {
    name: 'RH',
    leader: m('Patricia Mendoza Elizarraras', 'patricia@toroto.mx'),
    members: [m('Samantha Ortiz Sanchez', 'samantha@toroto.mx'), m('Karla Rebolledo Fernandez', 'karla@toroto.mx')],
  },
  {
    name: 'AYC',
    leader: m('Iván Castro Trujano', 'ivancastro@toroto.mx'),
    members: [
      m('Raúl Lucario Benitez', 'raul@toroto.mx'),
      m('Iris Becerra Reyes', 'iris@toroto.mx'),
      m('Aretha Flores González', 'aretha@toroto.mx'),
    ],
  },
  {
    name: 'Administración',
    leader: m('Iris Becerra Reyes', 'iris@toroto.mx'),
    members: [m('Diego García', 'diegogarcia@toroto.mx')],
  },
  {
    name: 'Contabilidad',
    leader: m('Raúl Lucario Benitez', 'raul@toroto.mx'),
    members: [m('Luis Miguel Polanco', 'luispolanco@toroto.mx')],
  },
  {
    name: 'Dirección de Innovación y Comms',
    leader: m('David Camhi De La Tejera', 'David@toroto.mx'),
    members: [
      m('Elva Leyva Cruz', 'elva@toroto.mx'),
      m('Samuel García Carreón', 'samuel@toroto.mx'),
      m('Guillermina Viancarlos', 'guillermina@toroto.mx'),
      m('Angie (Angélica) Martínez González', 'TI@toroto.mx'),
      m('Elis Arcia', 'dev@toroto.mx'),
      m('Sofía Sánchez Martínez', 'sofiasanchez@toroto.mx'),
    ],
  },
  {
    name: 'Innovación y Tecnología',
    leader: m('Guillermina Viancarlos', 'guillermina@toroto.mx'),
    members: [m('Bertha Hernández Valencia', 'bertha@toroto.mx')],
  },
  {
    name: 'Tecnología de la Información',
    leader: m('Elis Arcia', 'dev@toroto.mx'),
    members: [m('José Emiliano Flores Pérez', 'emilianoflores@toroto.mx')],
  },
  {
    name: 'Dirección P3',
    leader: m('Sofia Salas Ungar', 'sofiasalas@toroto.mx'),
    members: [m('Emiliano Guijosa Guadarrama', 'emiliano@toroto.mx')],
  },
  {
    name: 'P3',
    leader: m('Emiliano Guijosa Guadarrama', 'emiliano@toroto.mx'),
    members: [m('Eleazar Beh Miss', 'eleazar@toroto.mx')],
  },
  {
    name: 'Dirección de Carbono',
    leader: m('José Reyes Sanchez-Cutillas', 'jose@toroto.mx'),
    members: [
      m('Armando Falfan Cortes', 'armando@toroto.mx'),
      m('Andrea del Rocío Bárcenas García', 'andrea@toroto.mx'),
      m('Jenni Arce López', 'jenni@toroto.mx'),
      m('Juan Carlos Gallardo Brigido', 'juancarlosg@toroto.mx'),
    ],
  },
  {
    name: 'Gestión de Proyectos_Armando',
    leader: m('Armando Falfan Cortes', 'armando@toroto.mx'),
    members: [
      m('Mario Alberto Koyoc Uc', 'mariokoyoc@toroto.mx'),
      m('Miguel Angel Garzon Hernandez', 'miguel@toroto.mx'),
      m('Diana Laura Lomelí Ramírez', 'diana@toroto.mx'),
    ],
  },
  {
    name: 'Coordinación Territorial de Carbono_Mario',
    leader: m('Mario Alberto Koyoc Uc', 'mariokoyoc@toroto.mx'),
    members: [m('Renán Gonzalez Hoyos', 'renan@toroto.mx')],
  },
  {
    name: 'Gestión de Proyectos_Andrea del Rocío',
    leader: m('Andrea del Rocío Bárcenas García', 'andrea@toroto.mx'),
    members: [
      m('Juan José Romero Martínez', 'juanjose@toroto.mx'),
      m('Jenrry Octabio Santiago Alvarez', 'octabio@toroto.mx'),
      m('María José Cantoral Santos', 'cantoral@toroto.mx'),
    ],
  },
  {
    name: 'Gestión de Proyectos_Jenni',
    leader: m('Jenni Arce López', 'jenni@toroto.mx'),
    members: [
      m('Yessica Lyssete Cruz Diaz', 'yessica@toroto.mx'),
      m('Luis Antonio Loyde De La Cruz', 'luisloyde@toroto.mx'),
      m('Adrián Santiago Jiménez Ocampo', 'santiago.jimenez@toroto.mx'),
    ],
  },
  {
    name: 'Coordinación Territorial de Carbono_Yessica',
    leader: m('Yessica Lyssete Cruz Diaz', 'yessica@toroto.mx'),
    members: [
      m('Christian Gerardo Leon Moo', 'christian@toroto.mx'),
      m('Mauro Francisco Cruz Lorenso', 'mauro@toroto.mx'),
      m('Kelvint Anchevida', 'kelvint@toroto.mx'),
    ],
  },
  {
    name: 'Gerencia de Restauración Territorial',
    leader: m('Luis Ortega Arguelles', 'luis@toroto.mx'),
    members: [
      m('Karen Lizeth Caceres Ruiz', 'karen@toroto.mx'),
      m('Ana Schravesande Illescas', 'ana@toroto.mx'),
      m('Juan Lozano Lázaro', 'juan@toroto.mx'),
    ],
  },
  {
    name: 'DTP de Restauración Territorial',
    leader: m('Karen Lizeth Caceres Ruiz', 'karen@toroto.mx'),
    members: [m('Nasly Dayana Parra Rodríguez', 'nasly@toroto.mx')],
  },
  {
    name: 'OT_Juan',
    leader: m('Juan Lozano Lázaro', 'juan@toroto.mx'),
    members: [
      m('Xicotencatl Camacho Coronel', 'xicotencatl@toroto.mx'),
      m('Gilberto Gonzalez Barrios', 'gilberto@toroto.mx'),
      m('Gustavo Nicolas Gómez Pinacho', null),
    ],
  },
  {
    name: 'Coordinación Territorial de Carbono_Xico',
    leader: m('Xicotencatl Camacho Coronel', 'xicotencatl@toroto.mx'),
    members: [m('Juan Manuel Cortes Rivas', 'juanmanuel@toroto.mx'), m('Vanesa Hernández González', 'vanesa@toroto.mx')],
  },
  {
    name: 'Coordinación Territorial de Carbono_Alfredo',
    leader: m('Luis Ortega Arguelles', 'luis@toroto.mx'),
    members: [m('Helen Jacquelinne Hernández Roblero', 'helen@toroto.mx')],
  },
  {
    name: 'Coordinación Territorial de Carbono_Helen',
    leader: m('Helen Jacquelinne Hernández Roblero', 'helen@toroto.mx'),
    members: [
      m('Javier Ramirez Madero', null),
      m('Benito Ramirez Pasten', null),
      m('Marco Antonio Davila Torres', null),
      m('Jose Israel García Hernandez', null),
      m('Jorge Meneses Pérez', null),
    ],
  },
];

const norm = (s: string): string => s.trim().toLowerCase();

export function allTeamNames(): string[] {
  return ORG_TEAMS.map(t => t.name);
}

export function teamByName(name: string): OrgTeam | undefined {
  return ORG_TEAMS.find(t => t.name === name);
}

/** Todos los correos (líder + miembros) de un equipo, ignorando a quien aún no tiene correo asignado. */
export function rosterEmailsForTeam(teamName: string): string[] {
  const team = teamByName(teamName);
  if (!team) return [];
  const emails: string[] = [];
  if (team.leader.email) emails.push(team.leader.email);
  for (const member of team.members) if (member.email) emails.push(member.email);
  return emails;
}

/**
 * Todos los equipos que esa persona lidera. Casi siempre uno solo, pero algunas personas
 * (ej. Luis, que además de "Gerencia de Restauración Territorial" quedó a cargo del equipo
 * huérfano "_Alfredo") lideran más de uno — la cascada de permisos debe arrancar desde todos.
 */
export function teamsLedBy(email: string): OrgTeam[] {
  const target = norm(email);
  return ORG_TEAMS.filter(t => t.leader.email === target);
}

/** El primer equipo que esa persona lidera, si lidera alguno (compatibilidad con un solo resultado). */
export function teamLedBy(email: string): OrgTeam | undefined {
  return teamsLedBy(email)[0];
}

/**
 * "Equipo de origen" para vistas personales: el equipo que lidera si lidera uno, o si no,
 * el equipo del que es miembro (cubre a los perfiles de visión global que no lideran ninguna
 * DIRECCIÓN, como Karla, Samantha o Angie).
 */
export function homeTeamFor(email: string): string | null {
  const target = norm(email);
  const led = ORG_TEAMS.find(t => t.leader.email === target);
  if (led) return led.name;
  const asMember = ORG_TEAMS.find(t => t.members.some(mem => mem.email === target));
  return asMember ? asMember.name : null;
}

export function fullNameFor(email: string): string {
  const target = norm(email);
  for (const team of ORG_TEAMS) {
    if (team.leader.email === target) return team.leader.name;
    const found = team.members.find(mem => mem.email === target);
    if (found) return found.name;
  }
  return '';
}

export function firstNameFor(email: string): string {
  const full = fullNameFor(email);
  if (!full) return '';
  return full.replace(/\(.*?\)/g, '').trim().split(/\s+/)[0];
}

/** Usado por Reconocimientos para sugerir el rol/equipo de la persona que la IA identificó. */
export function guessNomineeRole(nomineeName: string): string {
  if (!nomineeName) return '';
  const target = nomineeName.trim().toLowerCase();
  for (const team of ORG_TEAMS) {
    if (team.leader.name.toLowerCase() === target) return `Líder, ${team.name}`;
    const found = team.members.find(mem => mem.name.toLowerCase() === target);
    if (found) return team.name;
  }
  return '';
}
