import type { Team } from './pulseData.ts';

/** Maps each known email to the DIRECCIÓN-level team name(s) they belong to (member or leader). */
export function buildEmailToTeams(teams: Team[], slackByName: Map<string, string>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (email: string | undefined, teamName: string) => {
    if (!email) return;
    if (!map.has(email)) map.set(email, []);
    const list = map.get(email)!;
    if (!list.includes(teamName)) list.push(teamName);
  };
  for (const team of teams) {
    add(slackByName.get(team.leaderName), team.name);
    for (const member of team.members) add(slackByName.get(member), team.name);
  }
  return map;
}
