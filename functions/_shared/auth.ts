// functions/_shared/auth.ts

const SESSION_SECRET = 'portfolio-session-secret-salt-2026';

export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createSessionToken(userId: string, username: string): Promise<string> {
  const payload = `${userId}:${username}:${Date.now()}`;
  const signature = await sha256(`${payload}:${SESSION_SECRET}`);
  const raw = `${payload}:${signature}`;
  return btoa(raw);
}

export async function verifySessionToken(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const raw = atob(token);
    const parts = raw.split(':');
    if (parts.length !== 4) return null;
    const [userId, username, timestampStr, signature] = parts;
    const expectedSig = await sha256(`${userId}:${username}:${timestampStr}:${SESSION_SECRET}`);
    if (signature !== expectedSig) return null;
    // Expire after 30 days
    const timestamp = parseInt(timestampStr, 10);
    if (Date.now() - timestamp > 30 * 24 * 60 * 60 * 1000) return null;
    return { userId, username };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(
  request: Request,
  env: Env,
): Promise<{ userId: string; username: string } | null> {
  // 1. Check Authorization header: Bearer <token>
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const verified = await verifySessionToken(token);
    if (verified) return verified;
  }

  // 2. Check Cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/portfolio_session=([^;]+)/);
    if (match?.[1]) {
      const verified = await verifySessionToken(match[1]);
      if (verified) return verified;
    }
  }

  // 3. Fallback for owner PIN / local auth header (e.g. X-Owner-Pin)
  const pinHeader = request.headers.get('X-Owner-Pin');
  if (pinHeader && (pinHeader === '8888' || pinHeader === '888888')) {
    const row = await env.DB.prepare('SELECT id, username FROM users WHERE username = ?')
      .bind('owner')
      .first<{ id: string; username: string }>();
    if (row) return { userId: row.id, username: row.username };
  }

  return null;
}
