import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyUserCredentials } from '../lib/auth';

describe('client authentication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('accepts only an explicit server success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    await expect(verifyUserCredentials('owner', 'strong-password')).resolves.toBe(true);
  });

  it('does not fall back to browser credentials when the server rejects or is unavailable', async () => {
    localStorage.setItem(
      'portfolio-user-account-v2',
      JSON.stringify({ username: 'owner', passwordHash: 'legacy' }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));
    await expect(verifyUserCredentials('owner', 'legacy-password')).resolves.toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(verifyUserCredentials('owner', 'anything')).resolves.toBe(false);
    expect(localStorage.getItem('portfolio-user-account-v2')).toBeNull();
  });
});
