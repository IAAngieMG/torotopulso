import { allTeamNames, firstNameFor, fullNameFor, homeTeamFor, teamByName, teamsLedBy, ORG_TEAMS } from './orgChart.ts';

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
export const VISION_GLOBAL_EMAILS = ['santiago@toroto.mx', 'ti@toroto.mx', 'patricia@toroto.mx', 'karla@toroto.mx'];

/**
 * Cuentas con acceso restringido a un solo equipo (y su cascada), sin ser líderes formales de
 * ese equipo ni tener visión global — ej. Samantha, que solo debe ver el pulso de RH.
 */
export const RESTRICTED_ACCESS: Record<string, string> = {
  'samantha@toroto.mx': 'RH',
};

/** Quién puede ver Reconocimientos del mes (como gestor o solo para consultar), sin importar visión global. */
export const RECOGNITIONS_VIEWER_EMAILS = ['santiago@toroto.mx', 'ti@toroto.mx', 'patricia@toroto.mx', 'samantha@toroto.mx', 'karla@toroto.mx'];

/** Únicas cuentas que pueden ver el buzón de feedback interno ("Feedback recibido"). */
export const FEEDBACK_INBOX_EMAILS = ['karla@toroto.mx', 'samantha@toroto.mx', 'ti@toroto.mx'];

/** Karla y Angie son quienes generan, aprueban y publican los diplomas de Reconocimientos. */
export const RECOGNITION_MANAGER_EMAILS = ['karla@toroto.mx', 'ti@toroto.mx'];

/** Angie y Karla pueden simular cualquier perfil con acceso a la plataforma vía "Ver como". */
export const VIEW_AS_MANAGER_EMAILS = ['ti@toroto.mx', 'karla@toroto.mx'];

export interface ViewAsTarget {
  email: string;
  label: string;
}

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * Calcula el alcance de "General" en cascada a partir de uno o más equipos raíz (una persona
 * puede liderar más de un equipo, ej. Luis): cada equipo raíz, más el equipo de cada uno de sus
 * miembros que también lidere otro equipo, y así recursivamente hacia abajo en el organigrama,
 * sin límite de niveles. Reemplaza la lista manual de "acceso ampliado" que se mantenía a mano —
 * el alcance ahora se deriva por completo de quién lidera qué en `orgChart.ts`.
 */
function calculateCascade(startTeamNames: string[]): string[] {
  const scope: string[] = [];
  const seen = new Set<string>();
  const queue = [...startTeamNames];
  while (queue.length > 0) {
    const teamName = queue.shift()!;
    if (seen.has(teamName)) continue;
    seen.add(teamName);
    scope.push(teamName);
    const team = teamByName(teamName);
    if (!team) continue;
    for (const member of team.members) {
      if (!member.email) continue;
      for (const led of teamsLedBy(member.email)) {
        if (!seen.has(led.name)) queue.push(led.name);
      }
    }
  }
  return scope;
}

/**
 * Resuelve qué puede ver un correo @toroto.mx autenticado: visión global (excepción manual,
 * sección 2) ve todo; de lo contrario, si lidera uno o más equipos, su alcance es la cascada
 * calculada desde todos ellos; si no lidera nada pero tiene un acceso restringido asignado
 * (sección `RESTRICTED_ACCESS`), su alcance es la cascada de ese único equipo; si ninguno aplica,
 * no tiene acceso.
 */
export function resolveOrgAccess(email: string): OrgAccess {
  const target = norm(email);
  const fullName = fullNameFor(target);
  const primaryTeam = homeTeamFor(target);

  if (VISION_GLOBAL_EMAILS.includes(target)) {
    return { granted: true, fullName, visionGlobal: true, primaryTeam, secondaryTeams: [], dataScope: 'all' };
  }

  const ledTeams = teamsLedBy(target);
  if (ledTeams.length > 0) {
    const generalScope = calculateCascade(ledTeams.map(t => t.name));
    const leaderPrimary = ledTeams[0].name;
    const secondaryTeams = generalScope.filter(t => t !== leaderPrimary);
    return { granted: true, fullName, visionGlobal: false, primaryTeam: leaderPrimary, secondaryTeams, dataScope: generalScope };
  }

  const restrictedTeam = RESTRICTED_ACCESS[target];
  if (restrictedTeam) {
    const generalScope = calculateCascade([restrictedTeam]);
    const secondaryTeams = generalScope.filter(t => t !== restrictedTeam);
    return { granted: true, fullName, visionGlobal: false, primaryTeam: restrictedTeam, secondaryTeams, dataScope: generalScope };
  }

  return { granted: false, fullName, visionGlobal: false, primaryTeam: null, secondaryTeams: [], dataScope: [] };
}

/**
 * Todos los perfiles que Angie y Karla pueden simular con "Ver como": cualquier líder de equipo
 * más las cuentas de visión global y de acceso restringido, siempre que de verdad tengan acceso
 * otorgado — ya no una lista fija de 7 nombres. `excludeEmails` quita del resultado a quien esté
 * viendo la lista (no tiene sentido "verse como uno mismo").
 */
export function allViewAsTargets(excludeEmails: string[] = []): ViewAsTarget[] {
  const exclude = new Set(excludeEmails.map(norm));
  const candidates = new Set<string>();
  for (const team of ORG_TEAMS) if (team.leader.email) candidates.add(team.leader.email);
  for (const e of VISION_GLOBAL_EMAILS) candidates.add(e);
  for (const e of Object.keys(RESTRICTED_ACCESS)) candidates.add(e);

  const targets: ViewAsTarget[] = [];
  for (const email of candidates) {
    if (exclude.has(email)) continue;
    const access = resolveOrgAccess(email);
    if (!access.granted) continue;
    targets.push({ email, label: firstNameFor(email) || access.fullName || email });
  }
  return targets.sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/** Nombres de equipo que un acceso realmente cubre, expandiendo "all" a todos los equipos reales. */
export function scopedTeamNames(access: OrgAccess): string[] {
  return access.dataScope === 'all' ? allTeamNames() : access.dataScope;
}
