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
  canManageRecognitions: boolean;
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

export interface AutoInsight {
  headline: string;
  bullets: string[];
  recommendation: string | null;
}

export interface Overview {
  teams: string[];
  availableTeams: string[];
  kpis: Kpis;
  weeklySeries: DailyPoint[];
  energyDistribution: EnergyDistribution | null;
  insight: AutoInsight;
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

/**
 * Rango que se muestra al entrar por primera vez a cualquier vista. Temporalmente en
 * 'lastWeek' mientras la tropa acumula respuestas de la semana en curso — cámbialo de
 * vuelta a 'week' en cuanto quieras que el feed arranque mostrando la semana actual.
 */
export const DEFAULT_RANGE: RangeOption = 'lastWeek';

export function fetchOverview(range: RangeOption, signal: SignalOption, team?: string) {
  const params = new URLSearchParams({ range, signal });
  if (team) params.set('team', team);
  return api(`/api/pulse/overview?${params}`) as Promise<Overview>;
}

export function fetchTeamsSummary(range: RangeOption, signal: SignalOption = 'ALL') {
  return api(`/api/pulse/teams-summary?range=${range}&signal=${signal}`) as Promise<{ teams: TeamSummary[] }>;
}

export function fetchPeople(range: RangeOption, onlyLeaders = false, signal: SignalOption = 'ALL') {
  return api(`/api/pulse/people?range=${range}&leaders=${onlyLeaders}&signal=${signal}`) as Promise<{ people: PersonSummary[] }>;
}

export function fetchTeamDetail(team: string, range: RangeOption, signal: SignalOption = 'ALL') {
  return api(`/api/pulse/team/${encodeURIComponent(team)}?range=${range}&signal=${signal}`) as Promise<TeamDetail>;
}

export function fetchPersonDetail(email: string, range: RangeOption, signal: SignalOption = 'ALL') {
  return api(`/api/pulse/person/${encodeURIComponent(email)}?range=${range}&signal=${signal}`) as Promise<PersonDetail>;
}

export function sendFeedback(message: string, view: string) {
  return api('/api/feedback', { method: 'POST', body: JSON.stringify({ message, view }) });
}

export function fetchFeedbackInbox() {
  return api('/api/feedback') as Promise<{ entries: FeedbackEntry[] }>;
}

export interface Nomination {
  id: string;
  submittedAt: string;
  month: string;
  nominatorName: string;
  nominatorEmail: string;
  rawText: string;
  record: RecognitionRecord | null;
}

export interface RecognitionRecord {
  id: string;
  month: string;
  nominatorName: string;
  nominatorEmail: string;
  rawText: string;
  nomineeName: string;
  diplomaText: string;
  tone: 'formal' | 'calido';
  status: 'pendiente' | 'generado' | 'aprobado' | 'publicado' | 'rechazado';
  reviewedBy?: string;
  publishedAt?: string;
}

export function fetchPendingRecognitions() {
  return api('/api/recognitions/pending') as Promise<{ month: string; pending: Nomination[] }>;
}

export function generateDiploma(id: string, tone: 'formal' | 'calido') {
  return api(`/api/recognitions/${encodeURIComponent(id)}/generate`, {
    method: 'POST',
    body: JSON.stringify({ tone }),
  }) as Promise<{ record: RecognitionRecord }>;
}

export function approveDiploma(id: string, nomineeName?: string, diplomaText?: string) {
  return api(`/api/recognitions/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ nomineeName, diplomaText }),
  }) as Promise<{ record: RecognitionRecord }>;
}

export function rejectNomination(id: string) {
  return api(`/api/recognitions/${encodeURIComponent(id)}/reject`, { method: 'POST' });
}

export function publishRecognitions() {
  return api('/api/recognitions/publish', { method: 'POST' }) as Promise<{ published: number; month: string }>;
}

export function fetchPublishedRecognitions(month?: string) {
  const q = month ? `?month=${encodeURIComponent(month)}` : '';
  return api(`/api/recognitions/published${q}`) as Promise<{ month: string; diplomas: RecognitionRecord[] }>;
}

export interface LaunchRequest {
  requestedBy: string;
  requestedAt: string;
  scheduledFor: string;
  label: string;
  status: 'pendiente' | 'atendida';
}

export function scheduleLaunch(scheduledFor: string, label: string) {
  return api('/api/recognitions/launch', {
    method: 'POST',
    body: JSON.stringify({ scheduledFor, label }),
  }) as Promise<{ request: LaunchRequest }>;
}

export function fetchLaunchRequest() {
  return api('/api/recognitions/launch-request') as Promise<{ request: LaunchRequest | null }>;
}

export function dismissLaunchRequest() {
  return api('/api/recognitions/launch/dismiss', { method: 'POST' });
}
