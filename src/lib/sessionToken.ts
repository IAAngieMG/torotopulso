import crypto from 'node:crypto';

export interface SignedSession {
  email: string;
  name: string;
  expiresAt: number;
}

export function signSession(session: SignedSession, secret: string): string {
  if (secret.length < 64) throw new Error('SESSION_SECRET debe tener al menos 64 caracteres.');
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySession(token: string, secret: string, now = Date.now()): SignedSession | null {
  if (secret.length < 64) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SignedSession;
    return session.email.endsWith('@toroto.mx') && session.expiresAt >= now ? session : null;
  } catch {
    return null;
  }
}
