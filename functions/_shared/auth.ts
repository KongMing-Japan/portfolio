// functions/_shared/auth.ts

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

type AuthEnv = Env & {
  SESSION_SECRET?: string;
  PORTFOLIO_SYNC_TOKEN?: string;
};

interface SessionPayload {
  userId: string;
  username: string;
  issuedAt: number;
  expiresAt: number;
}

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function sessionSecret(env: AuthEnv): string | null {
  const value = env.SESSION_SECRET?.trim();
  return value && value.length >= 32 ? value : null;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(
  env: AuthEnv,
  userId: string,
  username: string,
): Promise<string | null> {
  const secret = sessionSecret(env);
  if (!secret) return null;

  const issuedAt = Date.now();
  const payload = base64UrlEncode(
    JSON.stringify({
      userId,
      username,
      issuedAt,
      expiresAt: issuedAt + SESSION_MAX_AGE_MS,
    } satisfies SessionPayload),
  );
  const signature = await hmacHex(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  env: AuthEnv,
  token: string,
): Promise<SessionPayload | null> {
  const secret = sessionSecret(env);
  if (!secret) return null;

  try {
    const [payloadText, suppliedSignature, extra] = token.split('.');
    if (!payloadText || !suppliedSignature || extra) return null;

    const expectedSignature = await hmacHex(secret, payloadText);
    if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

    const payload = JSON.parse(base64UrlDecode(payloadText)) as Partial<SessionPayload>;
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.username !== 'string' ||
      typeof payload.issuedAt !== 'number' ||
      typeof payload.expiresAt !== 'number'
    ) {
      return null;
    }

    const now = Date.now();
    if (payload.issuedAt > now + CLOCK_SKEW_MS || payload.expiresAt <= now) return null;
    if (payload.expiresAt - payload.issuedAt !== SESSION_MAX_AGE_MS) return null;

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

async function resolveUser(
  env: AuthEnv,
  userId: string,
  username: string,
): Promise<{ userId: string; username: string } | null> {
  const row = await env.DB.prepare(
    'SELECT id, username FROM users WHERE id = ? AND username = ? COLLATE NOCASE',
  )
    .bind(userId, username)
    .first<{ id: string; username: string }>();
  return row ? { userId: row.id, username: row.username } : null;
}

export async function getAuthenticatedUser(
  request: Request,
  env: AuthEnv,
): Promise<{ userId: string; username: string } | null> {
  const authHeader = request.headers.get('Authorization');
  let token =
    authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;

  if (!token) {
    const cookieHeader = request.headers.get('Cookie');
    token = cookieHeader?.match(/(?:^|;\s*)portfolio_session=([^;]+)/)?.[1] ?? null;
  }

  if (!token) return null;
  const verified = await verifySessionToken(env, token);
  if (!verified) return null;
  return resolveUser(env, verified.userId, verified.username);
}

export async function getSyncServiceUser(
  request: Request,
  env: AuthEnv,
): Promise<{ userId: string; username: string } | null> {
  const configured = env.PORTFOLIO_SYNC_TOKEN?.trim();
  const supplied = request.headers.get('X-Portfolio-Sync-Token')?.trim();
  if (!configured || configured.length < 32 || !supplied || !constantTimeEqual(configured, supplied)) {
    return null;
  }

  const row = await env.DB.prepare(
    "SELECT id, username FROM users WHERE username = 'owner' COLLATE NOCASE",
  ).first<{ id: string; username: string }>();
  return row ? { userId: row.id, username: row.username } : null;
}
