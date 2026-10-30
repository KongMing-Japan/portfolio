import { describe, expect, it } from 'vitest';
import { sha256 } from '../_shared/auth';
import { onRequestPost as login } from './auth';
import { findForeignHoldingIds } from './holdings';

function loginDatabase(user: { id: string; username: string } | null): D1Database {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => user,
      }),
    }),
  } as unknown as D1Database;
}

describe('API ownership boundaries', () => {
  it('binds the global owner password to the configured owner username', async () => {
    const passwordHash = await sha256('correct-horse-battery-staple');
    const env = {
      DB: loginDatabase({ id: 'owner-id', username: 'owner' }),
      OWNER_USERNAME: 'owner',
      OWNER_PASSWORD_HASH: passwordHash,
      SESSION_SECRET: 'test-session-secret-that-is-at-least-32-characters',
    } as unknown as Env;

    const wrongIdentity = await login({
      request: new Request('https://portfolio.example/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'alice',
          password: 'correct-horse-battery-staple',
        }),
      }),
      env,
    } as never);

    expect(wrongIdentity.status).toBe(401);
    expect(wrongIdentity.headers.get('Set-Cookie')).toBeNull();

    const owner = await login({
      request: new Request('https://portfolio.example/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'owner',
          password: 'correct-horse-battery-staple',
        }),
      }),
      env,
    } as never);

    expect(owner.status).toBe(200);
    expect(owner.headers.get('Set-Cookie')).toContain('HttpOnly');
  });

  it('detects holding IDs owned by a different portfolio', async () => {
    const owners: Record<string, string> = {
      owned: 'portfolio-a',
      foreign: 'portfolio-b',
    };
    const db = {
      prepare: () => ({
        bind: (id: string) => ({ id }),
      }),
      batch: async (statements: Array<{ id: string }>) =>
        statements.map(({ id }) => ({
          results: owners[id] ? [{ portfolio_id: owners[id] }] : [],
        })),
    } as unknown as D1Database;

    await expect(
      findForeignHoldingIds(db, 'portfolio-a', ['owned', 'new', 'foreign']),
    ).resolves.toEqual(['foreign']);
  });
});
