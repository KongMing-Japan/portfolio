// functions/api/auth.ts
import {
  constantTimeEqual,
  createSessionToken,
  getAuthenticatedUser,
  sha256,
} from '../_shared/auth';

type LoginEnv = Env & {
  OWNER_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function sessionCookie(token: string, requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `portfolio_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${12 * 60 * 60}${secure}`;
}

function expiredSessionCookie(requestUrl: string): string {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `portfolio_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export const onRequestGet: PagesFunction<LoginEnv> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) return json({ authenticated: false }, 200);
  return json({ authenticated: true, user: { username: user.username } });
};

export const onRequestPost: PagesFunction<LoginEnv> = async (context) => {
  try {
    const body = (await context.request.json()) as Record<string, unknown>;
    const action = String(body.action || 'login');

    if (action === 'logout') {
      return json({ success: true }, 200, {
        'Set-Cookie': expiredSessionCookie(context.request.url),
      });
    }

    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    if (!username || !password) {
      return json({ error: 'Username and password are required' }, 400);
    }

    const configuredHash = context.env.OWNER_PASSWORD_HASH?.trim().toLowerCase();
    if (!configuredHash || !/^[a-f0-9]{64}$/.test(configuredHash) || !context.env.SESSION_SECRET) {
      return json({ error: 'Authentication is not configured' }, 503);
    }

    const user = await context.env.DB.prepare(
      'SELECT id, username FROM users WHERE username = ? COLLATE NOCASE',
    )
      .bind(username)
      .first<{ id: string; username: string }>();

    const suppliedHash = await sha256(password);
    if (!user || !constantTimeEqual(configuredHash, suppliedHash)) {
      return json({ error: 'Invalid username or password' }, 401);
    }

    const token = await createSessionToken(context.env, user.id, user.username);
    if (!token) return json({ error: 'Authentication is not configured' }, 503);

    return json(
      { success: true, user: { username: user.username } },
      200,
      { 'Set-Cookie': sessionCookie(token, context.request.url) },
    );
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
};
