import crypto from 'node:crypto';

/** Prefijo que distingue un token personal de API del token de sesión (Google) de 8h. */
export const API_TOKEN_PREFIX = 'pt_';

export const MAX_TOKENS_PER_EMAIL = 5;
const MAX_LABEL_LENGTH = 100;

export interface ApiTokenRecord {
  id: string;
  email: string;
  label: string;
  tokenHash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export function hashApiToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Genera un token opaco de un solo uso visible (solo se guarda su hash). */
export function generateApiToken(): { raw: string; hash: string } {
  const raw = `${API_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
  return { raw, hash: hashApiToken(raw) };
}

export function findApiTokenByRaw(tokens: Record<string, ApiTokenRecord>, raw: string): ApiTokenRecord | null {
  const hash = hashApiToken(raw);
  for (const record of Object.values(tokens)) {
    if (record.tokenHash === hash) return record;
  }
  return null;
}

export function cleanLabel(label: unknown): string {
  return String(label ?? '').trim().slice(0, MAX_LABEL_LENGTH);
}

export function canCreateMoreTokens(tokens: Record<string, ApiTokenRecord>, email: string): boolean {
  return Object.values(tokens).filter(t => t.email === email).length < MAX_TOKENS_PER_EMAIL;
}

/** Determina si una ruta `/api/...` (vista por la app, con el prefijo) es de solo lectura de Pulso — lo único que puede usar un token personal. */
export function isReadOnlyPulseRoute(method: string, apiRelativePath: string): boolean {
  return method === 'GET' && (apiRelativePath === '/me' || apiRelativePath.startsWith('/pulse/'));
}
