import type { RangeOption } from './scoring.ts';

export const TOKEN_KEY = 'pulsoTorotoSession';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ''}`,
  'Content-Type': 'application/json',
});

export async function api(url: string, options: RequestInit = {}) {
  const r = await fetch(url, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  if (r.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
    throw new Error('Sesión vencida o requerida');
  }
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Error en la solicitud');
  return d;
}

export interface Me {
  email: string;
  name: string;
  role: 'ejecutivo' | 'lider';
  teams: string[];
  canSeeFeedback: boolean;
}

export interface Kpis {
  bdAverage: number | null;
  btAverage: number | null;
  participationPct: number | null;
  participationDetail: string;
  onTimePct: number | null;
}

export interface DailyPoint {
  day: string;
  bd: number | null;
  bt: number | null;
}

export interface EnergyDistribution {
  altaEnergiaPct: number;
  enfoquePct: number;
  pausaPct: number;
}

export interface Questions {
  BD: string;
  AL: string;
  BT: string;
  VIERNES: string;
}

export interface Overview {
  teams: string[];
  availableTeams: string[];
  kpis: Kpis;
  weeklySeries: DailyPoint[];
  energyDistribution: EnergyDistribution | null;
  insight: string;
  questions: Questions;
}

export interface TeamSummary {
  team: string;
  leader: string;
  kpis: Kpis;
  trend: 'up' | 'down' | 'flat';
}

export interface PersonSummary {
  fullName: string;
  email: string;
  team: string;
  isLeader: boolean;
  kpis: Kpis;
}

export interface TeamMember {
  fullName: string;
  email: string;
  isLeader: boolean;
  weeklyKpis: Kpis;
}

export interface TeamDetail {
  team: string;
  leader: string;
  kpis: Kpis;
  weeklySeries: DailyPoint[];
  energyDistribution: EnergyDistribution | null;
  members: TeamMember[];
}

export interface PersonResponse {
  timestamp: string;
  qCode: string;
  question: string;
  rawScore: number | null;
  sentiment: string;
  choice: number | null;
}

export interface PersonDetail {
  email: string;
  fullName: string;
  teams: string[];
  kpis: Kpis;
  responses: PersonResponse[];
}

export interface FeedbackEntry {
  id: string;
  message: string;
  authorName: string;
  authorEmail: string;
  view: string;
  createdAt: string;
}

export type { RangeOption } from './scoring.ts';
export type SignalOption = 'ALL' | 'BD' | 'AL' | 'BT' | 'VIERNES';

export function fetchOverview(range: RangeOption, signal: SignalOption, team?: string) {
  const params = new URLSearchParams({ range, signal });
  if (team) params.set('team', team);
  return api(`/api/pulse/overview?${params}`) as Promise<Overview>;
}

export function fetchTeamsSummary(range: RangeOption) {
  return api(`/api/pulse/teams-summary?range=${range}`) as Promise<{ teams: TeamSummary[] }>;
}

export function fetchPeople(range: RangeOption, onlyLeaders = false) {
  return api(`/api/pulse/people?range=${range}&leaders=${onlyLeaders}`) as Promise<{ people: PersonSummary[] }>;
}

export function fetchTeamDetail(team: string, range: RangeOption) {
  return api(`/api/pulse/team/${encodeURIComponent(team)}?range=${range}`) as Promise<TeamDetail>;
}

export function fetchPersonDetail(email: string, range: RangeOption) {
  return api(`/api/pulse/person/${encodeURIComponent(email)}?range=${range}`) as Promise<PersonDetail>;
}

export function sendFeedback(message: string, view: string) {
  return api('/api/feedback', { method: 'POST', body: JSON.stringify({ message, view }) });
}

export function fetchFeedbackInbox() {
  return api('/api/feedback') as Promise<{ entries: FeedbackEntry[] }>;
}
