import { allTeamNames, fullNameFor, homeTeamFor, teamByName, teamLedBy } from './orgChart.ts';

export type DataScope = 'all' | string[];

export interface OrgAccess {
  granted: boolean;
  fullName: string;
  visionGlobal: boolean;
  /** Equipo propio para vistas "Mi equipo" — null solo si la persona no aparece en ningún equipo. */
  primaryTeam: string | null;
  /** Equipos adicionales a cargo, calculados en cascada desde `primaryTeam`. Vacío si no aplica. */
  secondaryTeams: string[];
  dataScope: DataScope;
}

/** Sección 2: visibilidad total, las 4 pestañas. */
export const VISION_GLOBAL_EMAILS = [
  'santiago@toroto.mx',
  'ti@toroto.mx',
  'patricia@toroto.mx',
  'samantha@toroto.mx',
  'karla@toroto.mx',
];

/** Únicas cuentas que pueden ver el buzón de feedback interno ("Feedback recibido"). */
export const FEEDBACK_INBOX_EMAILS = ['karla@toroto.mx', 'samantha@toroto.mx', 'ti@toroto.mx'];

/** Karla y Angie son quienes generan, aprueban y publican los diplomas de Reconocimientos. */
export const RECOGNITION_MANAGER_EMAILS = ['karla@toroto.mx', 'ti@toroto.mx'];

/** Perfiles fijos que Angie (ti@toroto.mx) puede simular con "Ver como", sin tocar su sesión real. */
export const VIEW_AS_TARGETS = [
  { email: 'santiago@toroto.mx', label: 'Santiago' },
  { email: 'patricia@toroto.mx', label: 'Patricia' },
  { email: 'karla@toroto.mx', label: 'Karla' },
  { email: 'alejandro@toroto.mx', label: 'Alejandro' },
  { email: 'dgavaldon@toroto.mx', label: 'Daniela' },
  { email: 'ivancastro@toroto.mx', label: 'Iván' },
  { email: 'david@toroto.mx', label: 'David' },
];

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * Calcula el alcance de "General" en cascada a partir del equipo de un líder: el equipo mismo,
 * más el equipo de cada uno de sus miembros que también lidere otro equipo, y así
 * recursivamente hacia abajo en el organigrama, sin límite de niveles. Reemplaza la lista
 * manual de "acceso ampliado" que se mantenía a mano — el alcance ahora se deriva por completo
 * de quién lidera qué en `orgChart.ts`.
 */
function calculateCascade(startTeamName: string): string[] {
  const scope: string[] = [];
  const seen = new Set<string>();
  const queue = [startTeamName];
  while (queue.length > 0) {
    const teamName = queue.shift()!;
    if (seen.has(teamName)) continue;
    seen.add(teamName);
    scope.push(teamName);
    const team = teamByName(teamName);
    if (!team) continue;
    for (const member of team.members) {
      if (!member.email) continue;
      const led = teamLedBy(member.email);
      if (led && !seen.has(led.name)) queue.push(led.name);
    }
  }
  return scope;
}

/**
 * Resuelve qué puede ver un correo @toroto.mx autenticado: visión global (excepción manual,
 * sección 2) ve todo; de lo contrario, si lidera un equipo, su alcance es la cascada calculada
 * desde ese equipo; si no lidera nada, no tiene acceso.
 */
export function resolveOrgAccess(email: string): OrgAccess {
  const target = norm(email);
  const fullName = fullNameFor(target);
  const primaryTeam = homeTeamFor(target);

  if (VISION_GLOBAL_EMAILS.includes(target)) {
    return { granted: true, fullName, visionGlobal: true, primaryTeam, secondaryTeams: [], dataScope: 'all' };
  }

  const led = teamLedBy(target);
  if (led) {
    const generalScope = calculateCascade(led.name);
    const secondaryTeams = generalScope.filter(t => t !== led.name);
    return { granted: true, fullName, visionGlobal: false, primaryTeam: led.name, secondaryTeams, dataScope: generalScope };
  }

  return { granted: false, fullName, visionGlobal: false, primaryTeam: null, secondaryTeams: [], dataScope: [] };
}

/** Nombres de equipo que un acceso realmente cubre, expandiendo "all" a todos los equipos reales. */
export function scopedTeamNames(access: OrgAccess): string[] {
  return access.dataScope === 'all' ? allTeamNames() : access.dataScope;
}
