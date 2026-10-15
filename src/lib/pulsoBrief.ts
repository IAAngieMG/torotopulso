import type { ResponseRecord } from './pulseData.ts';
import type { OrgAccess } from './orgPermissions.ts';
import { scopedTeamNames } from './orgPermissions.ts';
import { rosterEmailsForTeam, rosterForTeams, teamByName } from './orgChart.ts';
import { computeRedFlagsForRoster, computeVacationStatusForRoster } from './redFlags.ts';
import { filterVacationingEmails } from './vacations.ts';
import { applySignalFilter, buildAutoInsight, computeKpis, computeWeeklySeries, inRange, type OverviewKpis } from './scoring.ts';

/** Periodos que el brief de Pulso expone hacia afuera (ej. el conector MCP) — subconjunto de RangeOption sin 'realtime'/'lastWeek', que son solo para la UI. */
export type BriefRange = 'week' | 'month' | 'quarter' | 'semester' | 'year';

export const BRIEF_RANGE_LABELS: Record<BriefRange, string> = {
  week: 'Semana actual',
  month: 'Mes actual',
  quarter: 'Trimestre actual',
  semester: 'Semestre actual',
  year: 'Año actual',
};

function formatKpiLine(kpis: OverviewKpis): string {
  const parts: string[] = [];
  if (kpis.overallAverage !== null) parts.push(`ánimo general ${kpis.overallAverage}/5`);
  if (kpis.participationPct !== null) parts.push(`participación ${kpis.participationPct}%`);
  if (kpis.onTimePct !== null) parts.push(`puntualidad ${kpis.onTimePct}%`);
  if (kpis.bdOnTimePct !== null) parts.push(`inicio del día a tiempo ${kpis.bdOnTimePct}%`);
  return parts.length ? parts.join(' · ') : 'Sin datos suficientes en este periodo.';
}

export interface BuildPulsoBriefInput {
  access: OrgAccess;
  email: string;
  allRecords: ResponseRecord[];
  range: BriefRange;
  now?: Date;
}

/** Arma el brief de Pulso en markdown para el alcance (`access`) de la persona — mismo criterio de permisos que el dashboard y la API REST. */
export function buildPulsoBrief({ access, email, allRecords, range, now = new Date() }: BuildPulsoBriefInput): string {
  const teamsInScope = scopedTeamNames(access);
  const rosterEmails = new Set<string>();
  for (const team of teamsInScope) for (const e of rosterEmailsForTeam(team)) rosterEmails.add(e);
  const scopedRosterEmails = new Set(filterVacationingEmails(rosterEmails, 'ALL'));

  const records = applySignalFilter(
    allRecords.filter(r => scopedRosterEmails.has(r.email) && inRange(r, { range, now })),
    'ALL',
  );
  const kpis = computeKpis(records, scopedRosterEmails.size);
  const weeklySeries = computeWeeklySeries(records, now, range);
  const scopeLabel = access.dataScope === 'all' ? 'toda la tropa' : teamsInScope.join(', ') || 'tu equipo';
  const insight = buildAutoInsight(kpis, weeklySeries, scopeLabel, records);

  const teamLines = teamsInScope.map(teamName => {
    const team = teamByName(teamName);
    const teamRosterEmails = new Set(filterVacationingEmails(rosterEmailsForTeam(teamName), 'ALL'));
    const teamRecords = applySignalFilter(
      allRecords.filter(r => teamRosterEmails.has(r.email) && inRange(r, { range, now })),
      'ALL',
    );
    const teamKpis = computeKpis(teamRecords, teamRosterEmails.size);
    return `- **${teamName}**${team ? ` (líder ${team.leader.name})` : ''}: ${formatKpiLine(teamKpis)}`;
  });

  const homeTeams = email === 'ivancastro@toroto.mx' || !access.primaryTeam ? teamsInScope : [access.primaryTeam];
  const roster = rosterForTeams(homeTeams, { excludeEmail: email === 'santiago@toroto.mx' ? null : email });
  const redFlagPeople = computeRedFlagsForRoster(roster, allRecords, now);
  const vacations = computeVacationStatusForRoster(roster, now);

  const alertLines = redFlagPeople.map(p => `- **${p.fullName}** (${p.team}): ${p.flags.map(f => f.message).join(' · ')}`);
  const vacationLines = vacations.map(v => `- ${v.fullName} (${v.team}): ${v.message}`);

  const sections = [
    `# Brief de Pulso Toroto — ${BRIEF_RANGE_LABELS[range]}`,
    `_Generado el ${now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}_`,
    '',
    '## Resumen general',
    insight.headline,
    ...insight.bullets.map(b => `- ${b}`),
    '',
    `**KPIs:** ${formatKpiLine(kpis)}`,
    '',
    '## Por equipo',
    teamLines.length ? teamLines.join('\n') : '_Sin equipos en el alcance de esta cuenta._',
    '',
    '## Alertas',
    alertLines.length ? alertLines.join('\n') : '_Sin alertas activas._',
  ];

  if (vacationLines.length) {
    sections.push('', '## Vacaciones', vacationLines.join('\n'));
  }

  if (insight.recommendation) {
    sections.push('', '## Recomendación', insight.recommendation);
  }

  return sections.join('\n');
}
