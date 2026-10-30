import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSessionToken,
  getAuthenticatedUser,
  verifySessionToken,
} from './auth';

const secret = 'test-session-secret-that-is-at-least-32-characters';
const env = { SESSION_SECRET: secret } as unknown as Env;

describe('server authentication boundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a valid token and rejects tampering or a different secret', async () => {
    const token = await createSessionToken(env, 'user-1', 'owner');
    expect(token).toBeTruthy();
    await expect(verifySessionToken(env, token!)).resolves.toMatchObject({
      userId: 'user-1',
      username: 'owner',
    });
    await expect(verifySessionToken(env, `${token}x`)).resolves.toBeNull();
    await expect(
      verifySessionToken(
        { SESSION_SECRET: 'different-session-secret-that-is-long-enough' } as unknown as Env,
        token!,
      ),
    ).resolves.toBeNull();
  });

  it('fails closed without a deployment secret and expires sessions', async () => {
    await expect(createSessionToken({} as Env, 'user-1', 'owner')).resolves.toBeNull();
    const token = await createSessionToken(env, 'user-1', 'owner');
    vi.advanceTimersByTime(12 * 60 * 60 * 1000 + 1);
    await expect(verifySessionToken(env, token!)).resolves.toBeNull();
  });

  it('does not accept the legacy owner header', async () => {
    const request = new Request('https://portfolio.example/api/portfolio', {
      headers: { 'X-Owner-Pin': 'legacy-value' },
    });
    await expect(getAuthenticatedUser(request, env)).resolves.toBeNull();
  });
});
