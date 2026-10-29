// functions/api/auth.ts
import { createSessionToken, getAuthenticatedUser, sha256 } from '../_shared/auth';

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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const user = await getAuthenticatedUser(context.request, context.env);
  if (!user) {
    return json({ authenticated: false }, 200);
  }
  return json({ authenticated: true, user: { username: user.username } });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const body = (await context.request.json()) as Record<string, unknown>;
    const action = String(body.action || 'login');

    if (action === 'logout') {
      return json({ success: true }, 200, {
        'Set-Cookie': 'portfolio_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
      });
    }

    const username = String(body.username || '').trim() || 'owner';
    const password = String(body.password || body.pin || '').trim();

    if (!password) {
      return json({ error: 'Password or PIN is required' }, 400);
    }

    // Support both 4-digit PIN (8888) and 6-digit password (888888)
    const passwordHash = await sha256(password);

    // Look up in D1 users table
    const user = await context.env.DB.prepare(
      'SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE',
    )
      .bind(username)
      .first<{ id: string; username: string; password_hash: string }>();

    if (!user) {
      // Fallback: if username is owner and password is 8888 or 888888
      if ((username === 'owner' || username === 'admin') && (password === '8888' || password === '888888')) {
        const token = await createSessionToken('usr_owner_main', 'owner');
        return json(
          { success: true, token, user: { username: 'owner' } },
          200,
          {
            'Set-Cookie': `portfolio_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`,
          },
        );
      }
      return json({ error: 'Invalid username or password' }, 401);
    }

    // Check password hash
    const isValid =
      user.password_hash === passwordHash ||
      ((password === '8888' || password === '888888') && user.username === 'owner');

    if (!isValid) {
      return json({ error: 'Invalid username or password' }, 401);
    }

    const token = await createSessionToken(user.id, user.username);

    return json(
      {
        success: true,
        token,
        user: { username: user.username },
      },
      200,
      {
        'Set-Cookie': `portfolio_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}`,
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return json({ error: message }, 500);
  }
};
