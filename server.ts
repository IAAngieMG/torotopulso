import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getStore } from '@netlify/blobs';
import { GoogleGenAI } from '@google/genai';
import { signSession, verifySession, type SignedSession } from './src/lib/sessionToken.ts';
import { fetchSheetRows } from './src/lib/sheets.ts';
import { parseNominations, type Nomination } from './src/lib/recognitionData.ts';
import {
  parseRespuestas,
  parsePreguntas,
  currentQuestionFor,
  isFridaySignal,
  type ResponseRecord,
  type QuestionTemplate,
} from './src/lib/pulseData.ts';
import { ORG_TEAMS, allTeamNames, fullNameFor, firstNameFor, rosterEmailsForTeam, teamByName, guessNomineeRole } from './src/lib/orgChart.ts';
import {
  resolveOrgAccess,
  scopedTeamNames,
  allViewAsTargets,
  FEEDBACK_INBOX_EMAILS,
  RECOGNITION_MANAGER_EMAILS,
  RECOGNITIONS_VIEWER_EMAILS,
  VIEW_AS_MANAGER_EMAILS,
} from './src/lib/orgPermissions.ts';
import { computeRedFlagsForPerson, computeRedFlagsForRoster, type RosterPerson } from './src/lib/redFlags.ts';
import {
  computeKpis,
  computeWeeklySeries,
  computeEnergyDistribution,
  buildAutoInsight,
  inRange,
  type RangeFilter,
} from './src/lib/scoring.ts';

const clean = (v: unknown, n = 5000) => String(v ?? '').trim().slice(0, n);

const googleClientId = clean(process.env.GOOGLE_CLIENT_ID, 300).replace(/^['"]|['"]$/g, '');
const googleClientIdValid = /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId);
const sessionSecret = clean(process.env.SESSION_SECRET, 500);
const SHEET_ID = clean(process.env.SHEET_ID, 200);
const RECOGNITION_SHEET_ID = clean(process.env.RECOGNITION_SHEET_ID, 200);
const GEMINI_API_KEY = clean(process.env.GEMINI_API_KEY, 500);

function createSessionToken(session: SignedSession) {
  return signSession(session, sessionSecret);
}
function verifySessionToken(token: string) {
  return verifySession(token, sessionSecret);
}

// --- Sheet data cache --------------------------------------------------------
// El organigrama (equipos, líderes, permisos) ya no vive en el Sheet — es estático, ver
// src/lib/orgChart.ts. Solo `Respuestas` y `Preguntas` siguen viniendo en vivo del Sheet.
interface PulseData {
  responses: ResponseRecord[];
  preguntas: QuestionTemplate[];
}

const CACHE_TTL_MS = 90_000;
let cache: { data: PulseData; fetchedAt: number } | null = null;
let inflight: Promise<PulseData> | null = null;

async function loadPulseData(): Promise<PulseData> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  if (!inflight) {
    inflight = (async () => {
      const [respuestasRows, preguntasRows] = await Promise.all([
        fetchSheetRows(SHEET_ID, 'Respuestas'),
        fetchSheetRows(SHEET_ID, 'Preguntas'),
      ]);
      const data: PulseData = {
        responses: parseRespuestas(respuestasRows),
        preguntas: parsePreguntas(preguntasRows),
      };
      cache = { data, fetchedAt: Date.now() };
      return data;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** Roster de una lista de equipos, sin duplicados, opcionalmente sin la fila de `excludeEmail`. */
function buildRoster(teamNames: string[], excludeEmail: string | null): RosterPerson[] {
  const roster: RosterPerson[] = [];
  const seen = new Set<string>();
  for (const team of ORG_TEAMS) {
    if (!teamNames.includes(team.name)) continue;
    for (const person of [team.leader, ...team.members]) {
      if (!person.email || seen.has(person.email) || person.email === excludeEmail) continue;
      seen.add(person.email);
      roster.push({ email: person.email, fullName: person.name, team: team.name });
    }
  }
  return roster;
}

function applySignalFilter(records: ResponseRecord[], signal: string): ResponseRecord[] {
  const upper = signal.toUpperCase();
  if (!upper || upper === 'ALL') return records;
  return upper === 'VIERNES' ? records.filter(r => isFridaySignal(r.qCode)) : records.filter(r => r.qCode === upper);
}

/**
 * Identidad "efectiva" para las rutas de pulso: normalmente la del token de sesión, pero si
 * Angie o Karla mandaron el header `X-View-As` con el correo de cualquier perfil que de verdad
 * tenga acceso otorgado, se calculan alcance y saludo como si fueran esa persona — sin tocar su
 * sesión real. Feedback y Reconocimientos ignoran esto a propósito y siempre usan la sesión real.
 */
function effectiveIdentity(req: Request, session: SignedSession): { email: string; name: string; isViewingAs: boolean } {
  const viewAs = clean(req.header('x-view-as') || '', 320).toLowerCase();
  if (viewAs && VIEW_AS_MANAGER_EMAILS.includes(session.email)) {
    const access = resolveOrgAccess(viewAs);
    if (access.granted) {
      return { email: viewAs, name: firstNameFor(viewAs) || access.fullName.split(' ')[0] || viewAs, isViewingAs: true };
    }
  }
  return { email: session.email, name: session.name, isViewingAs: false };
}

// --- Netlify Blobs (feedback storage), with the same fallback we needed in Auditor Toroto ---
const useNetlifyBlobs = Boolean(process.env.NETLIFY || process.env.NETLIFY_SITE_ID);
const feedbackFile = path.resolve(process.env.FEEDBACK_FILE || './data/pulso-feedback.json');

function blobsStore(name: string) {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;
  return siteID && token ? getStore({ name, siteID, token }) : getStore(name);
}

interface FeedbackEntry {
  id: string;
  message: string;
  authorName: string;
  authorEmail: string;
  view: string;
  createdAt: string;
}

async function loadFeedback(): Promise<FeedbackEntry[]> {
  if (useNetlifyBlobs) {
    const remote = await blobsStore('pulso-toroto').get('feedback', { type: 'json' });
    return Array.isArray(remote) ? (remote as FeedbackEntry[]) : [];
  }
  try {
    return JSON.parse(fs.readFileSync(feedbackFile, 'utf8'));
  } catch {
    return [];
  }
}

async function saveFeedback(entries: FeedbackEntry[]) {
  if (useNetlifyBlobs) {
    await blobsStore('pulso-toroto').setJSON('feedback', entries);
    return;
  }
  fs.mkdirSync(path.dirname(feedbackFile), { recursive: true });
  fs.writeFileSync(feedbackFile, JSON.stringify(entries, null, 2));
}

// --- Reconocimientos: nominaciones vienen del sheet "Repositorio Reconocimientos"; lo que
// nosotros generamos y aprobamos (diploma, estado) se guarda aparte en Netlify Blobs, sin
// escribir de vuelta al sheet que alimenta el bot de Slack. ---
type RecognitionStatus = 'pendiente' | 'generado' | 'aprobado' | 'publicado' | 'rechazado';

interface RecognitionRecord {
  id: string;
  month: string;
  nominatorName: string;
  nominatorEmail: string;
  rawText: string;
  nomineeName: string;
  nomineeRole: string;
  diplomaText: string;
  tone: 'formal' | 'calido';
  status: RecognitionStatus;
  reviewedBy?: string;
  publishedAt?: string;
}

const recognitionsFile = path.resolve(process.env.RECOGNITIONS_FILE || './data/pulso-recognitions.json');

async function loadRecognitionRecords(): Promise<Record<string, RecognitionRecord>> {
  if (useNetlifyBlobs) {
    const remote = await blobsStore('pulso-toroto').get('recognitions', { type: 'json' });
    return remote && typeof remote === 'object' ? (remote as Record<string, RecognitionRecord>) : {};
  }
  try {
    return JSON.parse(fs.readFileSync(recognitionsFile, 'utf8'));
  } catch {
    return {};
  }
}

async function saveRecognitionRecords(records: Record<string, RecognitionRecord>) {
  if (useNetlifyBlobs) {
    await blobsStore('pulso-toroto').setJSON('recognitions', records);
    return;
  }
  fs.mkdirSync(path.dirname(recognitionsFile), { recursive: true });
  fs.writeFileSync(recognitionsFile, JSON.stringify(records, null, 2));
}

async function fetchNominations(): Promise<Nomination[]> {
  if (!RECOGNITION_SHEET_ID) return [];
  const rows = await fetchSheetRows(RECOGNITION_SHEET_ID, 'Respuestas');
  return parseNominations(rows);
}

/** Extrae a quién se reconoce y redacta el texto del diploma a partir del texto libre. */
async function generateDiplomaWithAI(rawText: string, tone: 'formal' | 'calido'): Promise<{ nomineeName: string; diplomaText: string }> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no está configurado en el servidor.');
  }
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const toneInstruction = tone === 'formal'
    ? 'Tono formal e institucional.'
    : 'Tono cálido y cercano, como si lo escribiera un compañero de equipo.';
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: `Un colaborador de Toroto escribió este mensaje para nominar a alguien a un reconocimiento mensual:\n\n"${rawText}"\n\nExtrae el nombre de la persona reconocida (si el mensaje no lo deja claro, responde "nomineeName": "") y redacta una mención de honor breve (2-3 frases) para un diploma, basada únicamente en lo que dice el mensaje, sin inventar logros que no se mencionen. ${toneInstruction} Devuelve JSON con "nomineeName" y "diplomaText".`,
    config: { responseMimeType: 'application/json' },
  });
  const parsed = JSON.parse(response.text || '{}');
  return {
    nomineeName: clean(parsed.nomineeName, 200),
    diplomaText: clean(parsed.diplomaText, 1500),
  };
}

// --- Solicitud de lanzamiento de Santiago: dispara la alerta que ven Angie/Karla ---
interface LaunchRequest {
  requestedBy: string;
  requestedAt: string;
  scheduledFor: string;
  label: string;
  status: 'pendiente' | 'atendida';
}

async function loadLaunchRequest(): Promise<LaunchRequest | null> {
  if (useNetlifyBlobs) {
    const remote = await blobsStore('pulso-toroto').get('recognitionLaunch', { type: 'json' });
    return remote && typeof remote === 'object' ? (remote as LaunchRequest) : null;
  }
  try {
    return JSON.parse(fs.readFileSync(launchRequestFile, 'utf8'));
  } catch {
    return null;
  }
}

async function saveLaunchRequest(request: LaunchRequest | null) {
  if (useNetlifyBlobs) {
    await blobsStore('pulso-toroto').setJSON('recognitionLaunch', request);
    return;
  }
  fs.mkdirSync(path.dirname(launchRequestFile), { recursive: true });
  fs.writeFileSync(launchRequestFile, JSON.stringify(request, null, 2));
}

const launchRequestFile = path.resolve(process.env.LAUNCH_REQUEST_FILE || './data/pulso-launch-request.json');

function currentRecognitionMonth(): string {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const now = new Date();
  return `${MESES[now.getMonth()]} ${now.getFullYear()}`;
}

// --- Express app -------------------------------------------------------------
function auth(req: Request, res: Response, next: NextFunction) {
  const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const s = verifySessionToken(t);
  if (!s) return res.status(401).json({ error: 'Sesión requerida o expirada.' });
  (req as any).session = s;
  next();
}

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.use((req, res, next) => {
    const allowed = new Set([process.env.APP_ORIGIN, process.env.URL, 'http://localhost:3001'].filter(Boolean));
    const o = req.headers.origin;
    if (o && allowed.has(o)) {
      res.setHeader('Access-Control-Allow-Origin', o);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/api/config', (_req, res) =>
    res.json({
      googleClientId: googleClientIdValid ? googleClientId : '',
      oauthConfigured: googleClientIdValid,
      oauthConfigurationError: googleClientIdValid
        ? ''
        : 'GOOGLE_CLIENT_ID no está configurado o no tiene el formato de un cliente OAuth Web.',
      sessionConfigured: sessionSecret.length >= 64,
      appOrigin: process.env.APP_ORIGIN || '',
      domain: 'toroto.mx',
    }),
  );

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.post('/api/auth/google', async (req, res) => {
    try {
      if (!googleClientIdValid) {
        return res.status(503).json({ error: 'Google OAuth no está configurado en el servidor.' });
      }
      const credential = clean(req.body?.credential, 10000);
      if (!credential) return res.status(400).json({ error: 'Credencial de Google no recibida.' });

      const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
      if (!r.ok) return res.status(401).json({ error: 'Credencial de Google inválida.' });
      const p: any = await r.json();
      const email = clean(p.email, 320).toLowerCase();
      const name = clean(p.name, 200);
      const verified = String(p.email_verified) === 'true' || p.email_verified === true;
      if (p.aud !== googleClientId && p.azp !== googleClientId) {
        return res.status(401).json({ error: 'La credencial no corresponde a este Client ID.' });
      }
      if (!verified) return res.status(401).json({ error: 'El correo electrónico no está verificado en Google.' });
      if (!email.endsWith('@toroto.mx')) {
        return res.status(403).json({ error: `Acceso restringido: el correo ${email} no pertenece al dominio @toroto.mx.` });
      }

      const access = resolveOrgAccess(email);
      if (!access.granted) {
        return res.status(403).json({
          error: 'Tu cuenta no tiene un rol de liderazgo asignado en Pulso Toroto. Pide que te agreguen al organigrama.',
        });
      }

      const displayName = firstNameFor(email) || name.split(' ')[0] || email.split('@')[0];
      const session: SignedSession = { email, name: displayName, expiresAt: Date.now() + 8 * 3600000 };
      res.json({ sessionToken: createSessionToken(session) });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible validar la sesión con Google.' });
    }
  });

  app.use('/api', auth);

  app.get('/api/me', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });
    const canUseViewAs = VIEW_AS_MANAGER_EMAILS.includes(session.email);
    res.json({
      email: effective.email,
      name: effective.name,
      visionGlobal: access.visionGlobal,
      teams: scopedTeamNames(access),
      primaryTeam: access.primaryTeam,
      secondaryTeams: access.secondaryTeams,
      canSeeFeedback: FEEDBACK_INBOX_EMAILS.includes(effective.email),
      canManageRecognitions: RECOGNITION_MANAGER_EMAILS.includes(effective.email),
      canViewRecognitions: RECOGNITIONS_VIEWER_EMAILS.includes(effective.email),
      isViewingAs: effective.isViewingAs,
      canUseViewAs,
      viewAsOptions: canUseViewAs ? allViewAsTargets([session.email]) : [],
    });
  });

  app.get('/api/pulse/overview', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const data = await loadPulseData();
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });

    const myTeams = scopedTeamNames(access);
    const requestedTeam = clean(req.query.team as string, 200);
    if (requestedTeam && !myTeams.includes(requestedTeam)) {
      return res.status(403).json({ error: 'No tienes acceso a ese equipo.' });
    }
    const teamsInScope = requestedTeam ? [requestedTeam] : myTeams;
    const rosterEmails = new Set<string>();
    for (const t of teamsInScope) for (const e of rosterEmailsForTeam(t)) rosterEmails.add(e);

    const range = (clean(req.query.range as string) || 'week') as RangeFilter['range'];
    const signal = clean(req.query.signal as string).toUpperCase() || 'ALL';

    const records = applySignalFilter(data.responses.filter(r => rosterEmails.has(r.email) && inRange(r, { range })), signal);

    const kpis = computeKpis(records, rosterEmails.size);
    const weeklySeries = computeWeeklySeries(records, new Date(), range);
    res.json({
      teams: teamsInScope,
      availableTeams: myTeams,
      kpis,
      weeklySeries,
      energyDistribution: computeEnergyDistribution(records),
      insight: buildAutoInsight(kpis, weeklySeries, requestedTeam || (access.dataScope === 'all' ? 'toda la tropa' : 'tus equipos')),
      questions: {
        BD: currentQuestionFor(data.preguntas, 'BD'),
        AL: currentQuestionFor(data.preguntas, 'AL'),
        BT: currentQuestionFor(data.preguntas, 'BT'),
        VIERNES: currentQuestionFor(data.preguntas, 'VIERNES'),
      },
    });
  });

  app.get('/api/pulse/red-flags', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const data = await loadPulseData();
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });

    const myTeams = scopedTeamNames(access);
    const requestedTeam = clean(req.query.team as string, 200);
    if (requestedTeam && !myTeams.includes(requestedTeam)) {
      return res.status(403).json({ error: 'No tienes acceso a ese equipo.' });
    }

    // En el inicio del dashboard, cada líder solo ve red flags de su propio equipo — los
    // equipos secundarios (y el resto de la tropa, para visión global) solo aparecen al entrar
    // a ese equipo puntual desde los filtros (`?team=`). Iván Castro es la única excepción: en
    // su inicio ve su equipo principal y los secundarios juntos.
    const homeTeams = effective.email === 'ivancastro@toroto.mx' || !access.primaryTeam ? myTeams : [access.primaryTeam];
    const teamsInScope = requestedTeam ? [requestedTeam] : homeTeams;

    // Ningún líder ve su propia fila en la lista de red flags — solo la gente de su equipo.
    // Santiago es la única excepción.
    const excludeEmail = effective.email === 'santiago@toroto.mx' ? null : effective.email;

    const roster = buildRoster(teamsInScope, excludeEmail);
    const people = computeRedFlagsForRoster(roster, data.responses, new Date());
    res.json({ people });
  });

  app.get('/api/pulse/teams-summary', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const data = await loadPulseData();
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });

    const range = (clean(req.query.range as string) || 'week') as RangeFilter['range'];
    const signal = clean(req.query.signal as string) || 'ALL';
    const myTeams = scopedTeamNames(access);
    const summary = myTeams.map(teamName => {
      const team = teamByName(teamName)!;
      const rosterEmails = new Set(rosterEmailsForTeam(teamName));
      const records = applySignalFilter(data.responses.filter(r => rosterEmails.has(r.email) && inRange(r, { range })), signal);
      const previous = applySignalFilter(
        data.responses.filter(r => rosterEmails.has(r.email) && inRange(r, { range: range === 'week' ? 'lastWeek' : range })),
        signal,
      );
      const kpis = computeKpis(records, rosterEmails.size);
      const previousKpis = range === 'week' ? computeKpis(previous, rosterEmails.size) : null;
      const trend =
        previousKpis?.bdAverage != null && kpis.bdAverage != null
          ? kpis.bdAverage > previousKpis.bdAverage
            ? 'up'
            : kpis.bdAverage < previousKpis.bdAverage
              ? 'down'
              : 'flat'
          : 'flat';
      return { team: team.name, leader: team.leader.name, kpis, trend };
    });
    res.json({ teams: summary, primaryTeam: access.primaryTeam, secondaryTeams: access.secondaryTeams });
  });

  app.get('/api/pulse/people', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const data = await loadPulseData();
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });

    const range = (clean(req.query.range as string) || 'week') as RangeFilter['range'];
    const signal = clean(req.query.signal as string) || 'ALL';
    const myTeams = scopedTeamNames(access);
    const onlyLeaders = clean(req.query.leaders as string) === 'true';

    const people: Array<{ fullName: string; email: string; team: string; isLeader: boolean; kpis: ReturnType<typeof computeKpis> }> = [];
    for (const team of ORG_TEAMS) {
      if (!myTeams.includes(team.name)) continue;
      const roster = onlyLeaders ? [team.leader] : [team.leader, ...team.members];
      for (const person of roster) {
        if (!person.email) continue;
        const records = applySignalFilter(data.responses.filter(r => r.email === person.email && inRange(r, { range })), signal);
        people.push({ fullName: person.name, email: person.email, team: team.name, isLeader: person === team.leader, kpis: computeKpis(records, 1) });
      }
    }
    res.json({ people });
  });

  app.get('/api/pulse/team/:team', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const data = await loadPulseData();
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });

    const teamName = clean(req.params.team, 200);
    const myTeams = scopedTeamNames(access);
    if (!myTeams.includes(teamName)) return res.status(403).json({ error: 'No tienes acceso a ese equipo.' });

    const team = teamByName(teamName);
    if (!team) return res.status(404).json({ error: 'Equipo no encontrado.' });

    const members = [team.leader, ...team.members]
      .filter(person => person.email)
      .map(person => {
        const personRecords = data.responses.filter(r => r.email === person.email && inRange(r, { range: 'week' }));
        return {
          fullName: person.name,
          email: person.email as string,
          isLeader: person === team.leader,
          weeklyKpis: computeKpis(personRecords, 1),
        };
      });

    const rosterEmails = new Set(members.map(m => m.email));
    const range = (clean(req.query.range as string) || 'week') as RangeFilter['range'];
    const signal = clean(req.query.signal as string) || 'ALL';
    const records = applySignalFilter(data.responses.filter(r => rosterEmails.has(r.email) && inRange(r, { range })), signal);

    res.json({
      team: team.name,
      leader: team.leader.name,
      kpis: computeKpis(records, rosterEmails.size),
      weeklySeries: computeWeeklySeries(records, new Date(), range),
      energyDistribution: computeEnergyDistribution(records),
      members,
    });
  });

  app.get('/api/pulse/person/:email', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const data = await loadPulseData();
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });

    const targetEmail = clean(req.params.email, 320).toLowerCase();
    const myTeams = scopedTeamNames(access);
    const personTeams = ORG_TEAMS.filter(t => t.leader.email === targetEmail || t.members.some(mem => mem.email === targetEmail)).map(t => t.name);
    const isSelf = targetEmail === effective.email;
    if (!isSelf && !personTeams.some(t => myTeams.includes(t))) {
      return res.status(403).json({ error: 'No tienes acceso a esta persona.' });
    }

    const range = (clean(req.query.range as string) || 'week') as RangeFilter['range'];
    const signal = clean(req.query.signal as string) || 'ALL';
    const records = applySignalFilter(
      data.responses.filter(r => r.email === targetEmail && inRange(r, { range })),
      signal,
    ).sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const allPersonRecords = data.responses.filter(r => r.email === targetEmail);
    res.json({
      email: targetEmail,
      fullName: fullNameFor(targetEmail),
      teams: personTeams,
      kpis: computeKpis(records, 1),
      responses: records,
      redFlags: computeRedFlagsForPerson(allPersonRecords, new Date()),
    });
  });

  app.post('/api/feedback', async (req, res) => {
    try {
      const session = (req as any).session as SignedSession;
      const message = clean(req.body?.message, 2000);
      const view = clean(req.body?.view, 200);
      if (!message) return res.status(400).json({ error: 'Escribe un mensaje antes de enviar.' });
      const entries = await loadFeedback();
      entries.push({
        id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        message,
        authorName: session.name,
        authorEmail: session.email,
        view,
        createdAt: new Date().toISOString(),
      });
      await saveFeedback(entries);
      res.status(201).json({ ok: true });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible guardar el feedback.' });
    }
  });

  app.get('/api/feedback', async (req, res) => {
    const session = (req as any).session as SignedSession;
    if (!FEEDBACK_INBOX_EMAILS.includes(session.email)) {
      return res.status(403).json({ error: 'No tienes acceso al buzón de feedback.' });
    }
    try {
      const entries = await loadFeedback();
      res.json({ entries: entries.reverse() });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible cargar el feedback.' });
    }
  });

  function requireRecognitionManager(req: Request, res: Response, next: NextFunction) {
    const session = (req as any).session as SignedSession;
    if (!RECOGNITION_MANAGER_EMAILS.includes(session.email)) {
      return res.status(403).json({ error: 'No tienes permiso para gestionar reconocimientos.' });
    }
    next();
  }

  app.post('/api/recognitions/launch', async (req, res) => {
    const session = (req as any).session as SignedSession;
    if (session.email !== 'santiago@toroto.mx') {
      return res.status(403).json({ error: 'Solo Santiago puede programar el lanzamiento del ciclo.' });
    }
    const scheduledFor = clean(req.body?.scheduledFor, 60);
    const label = clean(req.body?.label, 200) || `Ciclo de reconocimientos ${currentRecognitionMonth()}`;
    if (!scheduledFor) return res.status(400).json({ error: 'Falta la fecha de lanzamiento.' });
    const request: LaunchRequest = { requestedBy: session.email, requestedAt: new Date().toISOString(), scheduledFor, label, status: 'pendiente' };
    await saveLaunchRequest(request);
    res.status(201).json({ request });
  });

  app.get('/api/recognitions/launch-request', async (req, res) => {
    const session = (req as any).session as SignedSession;
    if (session.email !== 'santiago@toroto.mx' && !RECOGNITION_MANAGER_EMAILS.includes(session.email)) {
      return res.status(403).json({ error: 'No tienes acceso a esta información.' });
    }
    const request = await loadLaunchRequest();
    res.json({ request });
  });

  app.post('/api/recognitions/launch/dismiss', requireRecognitionManager, async (_req, res) => {
    await saveLaunchRequest(null);
    res.json({ ok: true });
  });

  app.get('/api/recognitions/pending', requireRecognitionManager, async (_req, res) => {
    try {
      const [nominations, records] = await Promise.all([fetchNominations(), loadRecognitionRecords()]);
      const pending = nominations
        .map(n => ({ ...n, record: records[n.id] || null }))
        .filter(n => !n.record || (n.record.status !== 'publicado' && n.record.status !== 'rechazado'));
      res.json({ month: currentRecognitionMonth(), pending });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible leer las nominaciones.' });
    }
  });

  app.post('/api/recognitions/:id/generate', requireRecognitionManager, async (req, res) => {
    try {
      const id = clean(req.params.id, 200);
      const tone: 'formal' | 'calido' = req.body?.tone === 'formal' ? 'formal' : 'calido';
      const nominations = await fetchNominations();
      const nomination = nominations.find(n => n.id === id);
      if (!nomination) return res.status(404).json({ error: 'Nominación no encontrada.' });

      const { nomineeName, diplomaText } = await generateDiplomaWithAI(nomination.rawText, tone);
      const records = await loadRecognitionRecords();
      records[id] = {
        id,
        month: nomination.month || currentRecognitionMonth(),
        nominatorName: nomination.nominatorName,
        nominatorEmail: nomination.nominatorEmail,
        rawText: nomination.rawText,
        nomineeName,
        nomineeRole: guessNomineeRole(nomineeName),
        diplomaText,
        tone,
        status: 'generado',
      };
      await saveRecognitionRecords(records);
      res.json({ record: records[id] });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible generar el diploma con IA.' });
    }
  });

  app.post('/api/recognitions/:id/approve', requireRecognitionManager, async (req, res) => {
    const session = (req as any).session as SignedSession;
    const id = clean(req.params.id, 200);
    const nomineeName = clean(req.body?.nomineeName, 200);
    if (!nomineeName) return res.status(400).json({ error: 'Escribe el nombre de la persona reconocida antes de aprobar.' });
    const records = await loadRecognitionRecords();
    // Permite aprobar directamente, sin pasar antes por "Generar con IA" — útil mientras el
    // Sheet de nominaciones no está conectado y se captura todo a mano.
    let record = records[id];
    if (!record) {
      const nominations = await fetchNominations();
      const nomination = nominations.find(n => n.id === id);
      if (!nomination) return res.status(404).json({ error: 'Nominación no encontrada.' });
      record = {
        id,
        month: nomination.month || currentRecognitionMonth(),
        nominatorName: nomination.nominatorName,
        nominatorEmail: nomination.nominatorEmail,
        rawText: nomination.rawText,
        nomineeName: '',
        nomineeRole: '',
        diplomaText: '',
        tone: 'calido',
        status: 'pendiente',
      };
    }
    const nomineeRole = clean(req.body?.nomineeRole, 200);
    const diplomaText = clean(req.body?.diplomaText, 1500);
    record.nomineeName = nomineeName;
    if (req.body?.nomineeRole !== undefined) record.nomineeRole = nomineeRole;
    if (diplomaText) record.diplomaText = diplomaText;
    record.status = 'aprobado';
    record.reviewedBy = session.email;
    records[id] = record;
    await saveRecognitionRecords(records);
    res.json({ record });
  });

  app.post('/api/recognitions/:id/reject', requireRecognitionManager, async (req, res) => {
    const id = clean(req.params.id, 200);
    const records = await loadRecognitionRecords();
    const nominations = await fetchNominations();
    const nomination = nominations.find(n => n.id === id);
    if (!nomination && !records[id]) return res.status(404).json({ error: 'Nominación no encontrada.' });
    records[id] = {
      ...(records[id] || {
        id, month: nomination?.month || currentRecognitionMonth(), nominatorName: nomination?.nominatorName || '',
        nominatorEmail: nomination?.nominatorEmail || '', rawText: nomination?.rawText || '', nomineeName: '', nomineeRole: '', diplomaText: '', tone: 'calido',
      }),
      status: 'rechazado',
    };
    await saveRecognitionRecords(records);
    res.json({ ok: true });
  });

  app.post('/api/recognitions/publish', requireRecognitionManager, async (_req, res) => {
    const records = await loadRecognitionRecords();
    const month = currentRecognitionMonth();
    let published = 0;
    for (const record of Object.values(records)) {
      if (record.status === 'aprobado' && record.month === month) {
        record.status = 'publicado';
        record.publishedAt = new Date().toISOString();
        published++;
      }
    }
    await saveRecognitionRecords(records);
    res.json({ published, month });
  });

  app.get('/api/recognitions/published', async (req, res) => {
    const month = clean(req.query.month as string, 60) || currentRecognitionMonth();
    const records = await loadRecognitionRecords();
    const diplomas = Object.values(records).filter(r => r.status === 'publicado' && r.month === month);
    res.json({ month, diplomas });
  });

  if (!process.env.NETLIFY && process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get(/.*/, (_q, resp) => resp.sendFile(path.join(dist, 'index.html')));
  }

  return app;
}

if (!process.env.NETLIFY) {
  createApp().then(app => {
    const PORT = Number(process.env.PORT || 3001);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Pulso Toroto corriendo en http://0.0.0.0:${PORT}`);
    });
  });
}
