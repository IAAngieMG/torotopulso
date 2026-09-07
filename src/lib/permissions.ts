import { grantsGlobalAccess, type SubTeam, type Team } from './pulseData.ts';

export type DataScope = 'all' | string[];

export interface AccessResult {
  granted: boolean;
  fullName: string;
  dataScope: DataScope;
  canSeeFeedback: boolean;
}

export const EXEC_EMAILS = [
  'santiago@toroto.mx',
  'ane@toroto.mx',
  'karla@toroto.mx',
  'patricia@toroto.mx',
  'ti@toroto.mx',
];

export const FEEDBACK_INBOX_EMAILS = ['karla@toroto.mx', 'ti@toroto.mx'];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Resolves what an authenticated @toroto.mx email is allowed to see, purely from the
 * live Sheet data (plus the 5 hardcoded executive emails, who always get full visibility
 * even if the Sheet doesn't happen to name them as a leader anywhere).
 */
export function resolveAccess(
  email: string,
  slackByEmail: Map<string, string>,
  teams: Team[],
  subTeams: SubTeam[],
  filtroEspecial: Map<string, string[]>,
): AccessResult {
  const lowerEmail = email.toLowerCase();
  const fullName = slackByEmail.get(lowerEmail) ?? '';
  const canSeeFeedback = FEEDBACK_INBOX_EMAILS.includes(lowerEmail);

  if (EXEC_EMAILS.includes(lowerEmail)) {
    return { granted: true, fullName, dataScope: 'all', canSeeFeedback };
  }

  if (fullName) {
    const filtro = filtroEspecial.get(fullName);
    if (filtro && filtro.length > 0) {
      if (grantsGlobalAccess(filtro)) return { granted: true, fullName, dataScope: 'all', canSeeFeedback };
      return { granted: true, fullName, dataScope: filtro.map(t => t.trim()), canSeeFeedback };
    }

    const ownTeams = teams.filter(t => norm(t.leaderName) === norm(fullName)).map(t => t.name);
    if (ownTeams.length > 0) {
      return { granted: true, fullName, dataScope: ownTeams, canSeeFeedback };
    }

    // Leads a granular sub-team (Grupos a detalles) but isn't in Filtro especial and
    // isn't a direct DIRECCIÓN-level leader either: map up to the parent team by
    // matching the sub-team's section header against a known DIRECCIÓN name.
    const ledSubTeam = subTeams.find(st => norm(st.leaderName) === norm(fullName));
    if (ledSubTeam) {
      const parentTeam = teams.find(t => norm(t.name) === norm(ledSubTeam.parentLabel));
      if (parentTeam) return { granted: true, fullName, dataScope: [parentTeam.name], canSeeFeedback };
    }
  }

  return { granted: false, fullName, dataScope: [], canSeeFeedback: false };
}
