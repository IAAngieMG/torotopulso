import { allTeamNames, fullNameFor, homeTeamFor, teamLedBy } from './orgChart.ts';

export type DataScope = 'all' | string[];

export interface OrgAccess {
  granted: boolean;
  fullName: string;
  visionGlobal: boolean;
  /** Equipo propio para vistas "Mi equipo" — null solo si la persona no aparece en ningún equipo. */
  primaryTeam: string | null;
  /** Equipos adicionales a cargo, explícitos en la sección 3 del organigrama. Vacío si no aplica. */
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

/** Karla y Angie manejan el buzón de feedback interno y el módulo de Reconocimientos. */
export const FEEDBACK_INBOX_EMAILS = ['karla@toroto.mx', 'ti@toroto.mx'];

interface ExpandedAccessEntry {
  email: string;
  primary: string;
  secondary: string[];
}

/** Sección 3: líderes con acceso ampliado (su grupo + equipos secundarios explícitos). */
export const EXPANDED_ACCESS: ExpandedAccessEntry[] = [
  {
    email: 'alejandro@toroto.mx',
    primary: 'Dirección de Gestión de Finanzas y Talento',
    secondary: ['Dirección de Operaciones Corporativas', 'RH', 'AYC', 'Administración', 'Contabilidad'],
  },
  {
    email: 'dgavaldon@toroto.mx',
    primary: 'Dirección de Operaciones Corporativas',
    secondary: ['RH', 'AYC', 'Administración', 'Contabilidad'],
  },
  {
    email: 'david@toroto.mx',
    primary: 'Dirección de Innovación y Comms',
    secondary: ['Innovación y Tecnología', 'Tecnología de la Información'],
  },
  {
    email: 'sofiasalas@toroto.mx',
    primary: 'Dirección P3',
    secondary: ['P3'],
  },
  {
    email: 'jose@toroto.mx',
    primary: 'Dirección de Carbono',
    secondary: [
      'Gestión de Proyectos_Armando',
      'Coordinación Territorial de Carbono_Mario',
      'Gestión de Proyectos_Andrea del Rocío',
      'Gestión de Proyectos_Jenni',
      'Coordinación Territorial de Carbono_Yessica',
    ],
  },
  {
    email: 'luis@toroto.mx',
    primary: 'Gerencia de Restauración Territorial',
    secondary: [
      'DTP de Restauración Territorial',
      'OT_Juan',
      'Coordinación Territorial de Carbono_Xico',
      'Coordinación Territorial de Carbono_Alfredo',
      'Coordinación Territorial de Carbono_Helen',
    ],
  },
];

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
 * Resuelve qué puede ver un correo @toroto.mx autenticado, siguiendo el orden de la sección 5
 * del organigrama: visión global > acceso ampliado > líder de su propio equipo > sin acceso.
 */
export function resolveOrgAccess(email: string): OrgAccess {
  const target = norm(email);
  const fullName = fullNameFor(target);
  const primaryTeam = homeTeamFor(target);

  if (VISION_GLOBAL_EMAILS.includes(target)) {
    return { granted: true, fullName, visionGlobal: true, primaryTeam, secondaryTeams: [], dataScope: 'all' };
  }

  const expanded = EXPANDED_ACCESS.find(e => e.email === target);
  if (expanded) {
    return {
      granted: true,
      fullName,
      visionGlobal: false,
      primaryTeam: expanded.primary,
      secondaryTeams: expanded.secondary,
      dataScope: [expanded.primary, ...expanded.secondary],
    };
  }

  const led = teamLedBy(target);
  if (led) {
    return { granted: true, fullName, visionGlobal: false, primaryTeam: led.name, secondaryTeams: [], dataScope: [led.name] };
  }

  return { granted: false, fullName, visionGlobal: false, primaryTeam: null, secondaryTeams: [], dataScope: [] };
}

/** Nombres de equipo que un acceso realmente cubre, expandiendo "all" a todos los equipos reales. */
export function scopedTeamNames(access: OrgAccess): string[] {
  return access.dataScope === 'all' ? allTeamNames() : access.dataScope;
}
