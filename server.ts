import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getStore } from '@netlify/blobs';
import { signSession, verifySession, type SignedSession } from './src/lib/sessionToken.ts';
import {
  API_TOKEN_PREFIX,
  canCreateMoreTokens,
  cleanLabel,
  findApiTokenByRaw,
  generateApiToken,
  isReadOnlyPulseRoute,
  type ApiTokenRecord,
} from './src/lib/apiTokens.ts';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createPulsoMcpServer } from './src/lib/mcpServer.ts';
import { fetchSheetRows } from './src/lib/sheets.ts';
import {
  parseRespuestas,
  parsePreguntas,
  currentQuestionFor,
  ANIV7_QCODE,
  type ResponseRecord,
  type QuestionTemplate,
} from './src/lib/pulseData.ts';
import { isAnniversaryCardVisible, computeAnniversarySummaryByTeam } from './src/lib/anniversary.ts';
import { ORG_TEAMS, allTeamNames, fullNameFor, firstNameFor, rosterEmailsForTeam, rosterForTeams, teamByName } from './src/lib/orgChart.ts';
import {
  resolveOrgAccess,
  scopedTeamNames,
  allViewAsTargets,
  FEEDBACK_INBOX_EMAILS,
  VIEW_AS_MANAGER_EMAILS,
} from './src/lib/orgPermissions.ts';
import { computeRedFlagsForPerson, computeRedFlagsForRoster, computeVacationStatusForRoster } from './src/lib/redFlags.ts';
import { activeVacation, vacationLabel, filterVacationingEmails } from './src/lib/vacations.ts';
import { pollyHistoryFor } from './src/lib/pollyHistory.ts';
import {
  computeKpis,
  computeWeeklySeries,
  computeEnergyDistribution,
  buildAutoInsight,
  inRange,
  applySignalFilter,
  kpisForPersonInRange,
  type RangeFilter,
} from './src/lib/scoring.ts';

const clean = (v: unknown, n = 5000) => String(v ?? '').trim().slice(0, n);

const googleClientId = clean(process.env.GOOGLE_CLIENT_ID, 300).replace(/^['"]|['"]$/g, '');
const googleClientIdValid = /^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId);
const sessionSecret = clean(process.env.SESSION_SECRET, 500);
const SHEET_ID = clean(process.env.SHEET_ID, 200);

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
  /** Respuestas normales (BD/AL/BT/Viernes) — nunca incluye la encuesta de aniversario "7 años Toroto". */
  responses: ResponseRecord[];
  /** Solo las respuestas de la encuesta "7 años Toroto" (qCode ANIV7) — separadas de los KPIs normales. */
  anniversaryResponses: ResponseRecord[];
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
      const allResponses = parseRespuestas(respuestasRows);
      const data: PulseData = {
        responses: allResponses.filter(r => r.qCode !== ANIV7_QCODE),
        anniversaryResponses: allResponses.filter(r => r.qCode === ANIV7_QCODE),
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

/**
 * Identidad "efectiva" para las rutas de pulso: normalmente la del token de sesión, pero si
 * Angie o Karla mandaron el header `X-View-As` con el correo de cualquier perfil que de verdad
 * tenga acceso otorgado, se calculan alcance y saludo como si fueran esa persona — sin tocar su
 * sesión real. Feedback ignora esto a propósito y siempre usa la sesión real.
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

// --- Tokens personales de API: permiten que una persona conecte su propio Claude/herramienta a
// sus datos de Pulso (solo lectura: GET /api/me y GET /api/pulse/*), con el mismo alcance que ya
// ve en el dashboard (resolveOrgAccess por su correo) — ver auth() y isReadOnlyPulseRoute(). ---
const apiTokensFile = path.resolve(process.env.API_TOKENS_FILE || './data/pulso-api-tokens.json');

async function loadApiTokens(): Promise<Record<string, ApiTokenRecord>> {
  if (useNetlifyBlobs) {
    const remote = await blobsStore('pulso-toroto').get('apiTokens', { type: 'json' });
    return remote && typeof remote === 'object' ? (remote as Record<string, ApiTokenRecord>) : {};
  }
  try {
    return JSON.parse(fs.readFileSync(apiTokensFile, 'utf8'));
  } catch {
    return {};
  }
}

async function saveApiTokens(tokens: Record<string, ApiTokenRecord>) {
  if (useNetlifyBlobs) {
    await blobsStore('pulso-toroto').setJSON('apiTokens', tokens);
    return;
  }
  fs.mkdirSync(path.dirname(apiTokensFile), { recursive: true });
  fs.writeFileSync(apiTokensFile, JSON.stringify(tokens, null, 2));
}

// --- Express app -------------------------------------------------------------
async function auth(req: Request, res: Response, next: NextFunction) {
  const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (t.startsWith(API_TOKEN_PREFIX)) {
    // req.path es relativo al punto de montaje ('/api'), ej. '/pulse/overview' o '/me'.
    if (!isReadOnlyPulseRoute(req.method, req.path)) {
      return res.status(403).json({ error: 'Este token de API solo puede leer datos de Pulso (GET /api/pulse/* y /api/me).' });
    }
    try {
      const tokens = await loadApiTokens();
      const record = findApiTokenByRaw(tokens, t);
      if (!record) return res.status(401).json({ error: 'Token de API inválido o revocado.' });
      (req as any).session = { email: record.email, name: record.label || record.email, expiresAt: Infinity } as SignedSession;
      (req as any).isApiToken = true;
      tokens[record.id] = { ...record, lastUsedAt: new Date().toISOString() };
      saveApiTokens(tokens).catch(() => {});
      return next();
    } catch {
      return res.status(502).json({ error: 'No fue posible validar el token de API.' });
    }
  }
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
      canDeleteFeedback: effective.email === 'ti@toroto.mx',
      isViewingAs: effective.isViewingAs,
      canUseViewAs,
      viewAsOptions: canUseViewAs ? allViewAsTargets([session.email]) : [],
    });
  });

  // Autoservicio para conectar herramientas externas (ej. un asistente personal) a los propios
  // datos de Pulso de alguien, sin compartir su sesión de Google. Un token de API no puede crear
  // ni listar otros tokens (auth() ya lo bloquea por no ser una ruta de solo lectura de Pulso).
  app.post('/api/tokens', async (req, res) => {
    const session = (req as any).session as SignedSession;
    try {
      const label = cleanLabel(req.body?.label) || 'Token sin nombre';
      const tokens = await loadApiTokens();
      if (!canCreateMoreTokens(tokens, session.email)) {
        return res.status(400).json({ error: 'Ya tienes el máximo de tokens activos. Revoca alguno antes de crear otro.' });
      }
      const { raw, hash } = generateApiToken();
      const id = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const record: ApiTokenRecord = { id, email: session.email, label, tokenHash: hash, createdAt: new Date().toISOString(), lastUsedAt: null };
      tokens[id] = record;
      await saveApiTokens(tokens);
      res.status(201).json({ id, label, token: raw, createdAt: record.createdAt });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible crear el token.' });
    }
  });

  app.get('/api/tokens', async (req, res) => {
    const session = (req as any).session as SignedSession;
    try {
      const tokens = await loadApiTokens();
      const mine = Object.values(tokens)
        .filter(t => t.email === session.email)
        .map(({ tokenHash: _tokenHash, ...rest }) => rest)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json({ tokens: mine });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible cargar tus tokens.' });
    }
  });

  app.delete('/api/tokens/:id', async (req, res) => {
    const session = (req as any).session as SignedSession;
    try {
      const id = clean(req.params.id, 100);
      const tokens = await loadApiTokens();
      const record = tokens[id];
      if (!record || record.email !== session.email) return res.status(404).json({ error: 'Token no encontrado.' });
      delete tokens[id];
      await saveApiTokens(tokens);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible revocar el token.' });
    }
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
    const allRosterEmails = new Set<string>();
    for (const t of teamsInScope) for (const e of rosterEmailsForTeam(t)) allRosterEmails.add(e);

    const range = (clean(req.query.range as string) || 'week') as RangeFilter['range'];
    const signal = clean(req.query.signal as string).toUpperCase() || 'ALL';

    // Quien esté de vacaciones (o exento de ese signal puntual, ej. David sin Encuesta Viernes)
    // no cuenta como "esperado sin responder" en la participación.
    const rosterEmails = new Set(filterVacationingEmails(allRosterEmails, signal));

    const records = applySignalFilter(data.responses.filter(r => rosterEmails.has(r.email) && inRange(r, { range })), signal);

    const kpis = computeKpis(records, rosterEmails.size);
    const weeklySeries = computeWeeklySeries(records, new Date(), range);
    res.json({
      teams: teamsInScope,
      availableTeams: myTeams,
      kpis,
      weeklySeries,
      energyDistribution: computeEnergyDistribution(records),
      insight: buildAutoInsight(kpis, weeklySeries, requestedTeam || (access.dataScope === 'all' ? 'toda la tropa' : 'tus equipos'), records),
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

    const roster = rosterForTeams(teamsInScope, { excludeEmail });
    const people = computeRedFlagsForRoster(roster, data.responses, new Date());
    const vacations = computeVacationStatusForRoster(roster, new Date());
    res.json({ people, vacations });
  });

  // Tarjeta "7 años Toroto" (aniversario) — separada de las métricas normales, ver
  // src/lib/anniversary.ts. Mismo criterio de alcance que /api/pulse/red-flags: en el inicio del
  // dashboard cada líder ve solo su(s) equipo(s) de casa; dentro del detalle de un equipo se
  // acota a ese equipo con `?team=`.
  app.get('/api/pulse/anniversary', async (req, res) => {
    const session = (req as any).session as SignedSession;
    const effective = effectiveIdentity(req, session);
    const access = resolveOrgAccess(effective.email);
    if (!access.granted) return res.status(403).json({ error: 'Acceso revocado.' });

    const visible = isAnniversaryCardVisible(new Date());
    if (!visible) return res.json({ visible: false, teams: [] });

    const data = await loadPulseData();
    const myTeams = scopedTeamNames(access);
    const requestedTeam = clean(req.query.team as string, 200);
    if (requestedTeam && !myTeams.includes(requestedTeam)) {
      return res.status(403).json({ error: 'No tienes acceso a ese equipo.' });
    }

    const homeTeams = effective.email === 'ivancastro@toroto.mx' || !access.primaryTeam ? myTeams : [access.primaryTeam];
    const teamsInScope = requestedTeam ? [requestedTeam] : homeTeams;

    const roster = rosterForTeams(teamsInScope);
    const teams = computeAnniversarySummaryByTeam(roster, data.anniversaryResponses);
    res.json({ visible: true, teams });
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
      const rosterEmails = new Set(filterVacationingEmails(rosterEmailsForTeam(teamName), signal));
      const records = applySignalFilter(data.responses.filter(r => rosterEmails.has(r.email) && inRange(r, { range })), signal);
      const previous = applySignalFilter(
        data.responses.filter(r => rosterEmails.has(r.email) && inRange(r, { range: range === 'week' ? 'lastWeek' : range })),
        signal,
      );
      const kpis = computeKpis(records, rosterEmails.size);
      const previousKpis = range === 'week' ? computeKpis(previous, rosterEmails.size) : null;
      // La tendencia refleja ánimo, así que se basa en moodAverage (Cierre del día y, desde que
      // pasó a la misma escala 1-5, Inicio del día) — el check-in viejo de botones nunca mueve
      // este indicador, porque no aporta a moodAverage (ver scoring.ts).
      const trend =
        previousKpis?.moodAverage != null && kpis.moodAverage != null
          ? kpis.moodAverage > previousKpis.moodAverage
            ? 'up'
            : kpis.moodAverage < previousKpis.moodAverage
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

    const roster = rosterForTeams(myTeams, { onlyLeaders });
    const now = new Date();
    const people = roster.map(person => {
      const records = applySignalFilter(data.responses.filter(r => r.email === person.email && inRange(r, { range })), signal);
      const vacation = activeVacation(person.email, now);
      return { ...person, kpis: computeKpis(records, 1), vacationLabel: vacation ? vacationLabel(vacation) : null };
    });
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

    const now = new Date();
    const range = (clean(req.query.range as string) || 'week') as RangeFilter['range'];
    const signal = clean(req.query.signal as string) || 'ALL';

    // Las tarjetas de miembro deben reflejar el mismo rango y señal que el resto de la página
    // (gráfica y KPIs de equipo): antes se congelaban siempre en la semana en curso, así que un
    // líder viendo "semana pasada" veía un número ahí que no correspondía al resto de la vista.
    const members = [team.leader, ...team.members]
      .filter(person => person.email)
      .map(person => {
        const vacation = activeVacation(person.email as string, now);
        return {
          fullName: person.name,
          email: person.email as string,
          isLeader: person === team.leader,
          kpis: kpisForPersonInRange(data.responses, person.email as string, { range }, signal),
          vacationLabel: vacation ? vacationLabel(vacation) : null,
        };
      });

    const rosterEmails = new Set(filterVacationingEmails(members.map(m => m.email), signal));
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
    const vacation = activeVacation(targetEmail);

    // Análisis de la semana pasada para esta persona, fijo (no sigue el rango/señal elegidos en la
    // UI): reemplaza el listado de respuesta por respuesta con algo más productivo de leer.
    const now = new Date();
    const lastWeekRecords = allPersonRecords.filter(r => inRange(r, { range: 'lastWeek', now }));
    const lastWeekKpis = computeKpis(lastWeekRecords, 1);
    const lastWeekSeries = computeWeeklySeries(lastWeekRecords, now, 'lastWeek');

    res.json({
      email: targetEmail,
      fullName: fullNameFor(targetEmail),
      teams: personTeams,
      kpis: computeKpis(records, 1),
      responses: records,
      redFlags: computeRedFlagsForPerson(targetEmail, allPersonRecords, new Date()),
      vacationLabel: vacation ? vacationLabel(vacation) : null,
      pollyHistory: pollyHistoryFor(targetEmail),
      lastWeekInsight: buildAutoInsight(lastWeekKpis, lastWeekSeries, fullNameFor(targetEmail), lastWeekRecords, true),
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

  app.delete('/api/feedback/:id', async (req, res) => {
    const session = (req as any).session as SignedSession;
    if (session.email !== 'ti@toroto.mx') {
      return res.status(403).json({ error: 'Solo Angie puede eliminar feedback.' });
    }
    try {
      const id = clean(req.params.id, 100);
      const entries = await loadFeedback();
      const filtered = entries.filter(e => e.id !== id);
      if (filtered.length === entries.length) return res.status(404).json({ error: 'Feedback no encontrado.' });
      await saveFeedback(filtered);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(502).json({ error: error.message || 'No fue posible eliminar el feedback.' });
    }
  });

  // Conector MCP remoto para Pulso: una cuenta externa (ej. el Claude de alguien, agregado como
  // "conector personalizado") se autentica con su propio token de "Acceso API" y jala su brief en
  // vivo — a diferencia de la skill basada en fetch directo, un conector MCP lo llama Claude desde
  // sus propios servidores, no desde el sandbox del chat, así que no choca con listas de sitios
  // permitidos del lado del cliente. Servidor MCP nuevo por request (modo stateless): encaja con
  // el runtime sin estado de las funciones de Netlify, ver `createPulsoMcpServer`.
  async function mcpAuthenticate(req: Request): Promise<{ email: string } | null> {
    const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!t.startsWith(API_TOKEN_PREFIX)) return null;
    const tokens = await loadApiTokens();
    const record = findApiTokenByRaw(tokens, t);
    if (!record) return null;
    tokens[record.id] = { ...record, lastUsedAt: new Date().toISOString() };
    saveApiTokens(tokens).catch(() => {});
    return { email: record.email };
  }

  // El SDK de MCP exige que el POST a `/mcp` traiga el header `Content-Type: application/json`
  // exacto, y lo rechaza con 415 si no — incluido cuando un cliente (como la comprobación inicial
  // de conectividad de Claude.ai al agregar el conector) manda otro Content-Type, o ninguno, en una
  // petición de prueba. El transporte lee las cabeceras desde `req.rawHeaders` (vía
  // `@hono/node-server`), no desde el objeto `req.headers` ya parseado de Express/Node — así que
  // hay que corregir ahí. Como `/mcp` solo acepta JSON de todos modos, forzamos el header en ambos
  // lugares y, si el parser global de arriba no alcanzó a leer el cuerpo (porque vio un Content-Type
  // distinto), lo leemos aquí manualmente.
  app.use('/mcp', (req, res, next) => {
    req.headers['content-type'] = 'application/json';
    const rawHeaders = req.rawHeaders;
    for (let i = 0; i < rawHeaders.length; i += 2) {
      if (rawHeaders[i].toLowerCase() === 'content-type') rawHeaders[i + 1] = 'application/json';
    }
    if (!rawHeaders.some(h => h.toLowerCase() === 'content-type')) rawHeaders.push('Content-Type', 'application/json');
    if (req.method !== 'POST' || req.body !== undefined) return next();
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      if (rawBody) {
        try {
          req.body = JSON.parse(rawBody);
        } catch {
          // Deja el body vacío; el SDK de MCP reporta su propio error de parseo JSON-RPC.
        }
      }
      next();
    });
  });

  // El SDK de MCP exige que el POST a `/mcp` traiga el header `Content-Type: application/json`
  // exacto, y lo rechaza con 415 si no — incluido cuando un cliente (como la comprobación inicial
  // de conectividad de Claude.ai al agregar el conector) manda otro Content-Type, o ninguno, en una
  // petición de prueba. El transporte lee las cabeceras desde `req.rawHeaders` (vía
  // `@hono/node-server`), no desde el objeto `req.headers` ya parseado de Express/Node — así que
  // hay que corregir ahí. Como `/mcp` solo acepta JSON de todos modos, forzamos el header en ambos
  // lugares y, si el parser global de arriba no alcanzó a leer el cuerpo (porque vio un Content-Type
  // distinto), lo leemos aquí manualmente.
  app.use('/mcp', (req, res, next) => {
    req.headers['content-type'] = 'application/json';
    const rawHeaders = req.rawHeaders;
    for (let i = 0; i < rawHeaders.length; i += 2) {
      if (rawHeaders[i].toLowerCase() === 'content-type') rawHeaders[i + 1] = 'application/json';
    }
    if (!rawHeaders.some(h => h.toLowerCase() === 'content-type')) rawHeaders.push('Content-Type', 'application/json');
    if (req.method !== 'POST' || req.body !== undefined) return next();
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      if (rawBody) {
        try {
          req.body = JSON.parse(rawBody);
        } catch {
          // Deja el body vacío; el SDK de MCP reporta su propio error de parseo JSON-RPC.
        }
      }
      next();
    });
  });

  app.post('/mcp', async (req, res) => {
    // No se rechaza aquí con 401 por falta/token inválido: algunos clientes MCP hacen una conexión
    // de prueba sin credenciales antes de aplicar el header configurado, y un 401 a nivel de
    // transporte en el handshake se ve como "servidor inválido" en vez de un problema de auth. El
    // control de acceso real pasa dentro de la tool (`createPulsoMcpServer`), que nunca entrega
    // datos sin un token válido.
    const session = await mcpAuthenticate(req);
    try {
      const server = createPulsoMcpServer({ email: session?.email ?? null, loadRecords: async () => (await loadPulseData()).responses });
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on('close', () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error: any) {
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: error.message || 'Error interno del servidor MCP.' }, id: null });
      }
    }
  });

  app.get('/mcp', (_req, res) => {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  });

  app.delete('/mcp', (_req, res) => {
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  });

  // Antes de conectar, un cliente MCP (Claude.ai incluido) sondea estas rutas de descubrimiento de
  // OAuth (RFC 9728 / RFC 8414) para saber si el servidor requiere auth delegada. Sin una ruta
  // explícita, caían en el catch-all de la SPA de abajo y devolvían 200 con el HTML del dashboard —
  // el cliente intenta parsearlo como JSON, falla, y el conector se ve como "no se pudo conectar"
  // aunque `/mcp` en sí responda bien. No usamos OAuth (solo el token Bearer de "Acceso API"), así
  // que la respuesta correcta es un 404 JSON limpio, no el HTML del front.
  app.get(
    ['/.well-known', '/.well-known/*splat'],
    (_req, res) => {
      res.status(404).json({ error: 'not_found' });
    },
  );

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
