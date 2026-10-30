/**
 * Server-backed owner authentication.
 *
 * The browser stores only a non-authoritative UI marker. Protected data and mutations
 * always require the HttpOnly session cookie issued by /api/auth.
 */

const AUTH_SESSION_KEY = 'portfolio-auth-session-v3';
const LEGACY_ACCOUNT_KEY = 'portfolio-user-account-v2';
const LEGACY_CLOUD_TOKEN_KEY = 'portfolio-cloud-token';

export const DEFAULT_USER = {
  username: 'owner',
};

function clearLegacyCredentials(): void {
  try {
    localStorage.removeItem(LEGACY_ACCOUNT_KEY);
    sessionStorage.removeItem(LEGACY_CLOUD_TOKEN_KEY);
  } catch {}
}

export async function verifyUserCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  clearLegacyCredentials();
  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export async function checkServerSession(): Promise<{
  authenticated: boolean;
  username?: string;
}> {
  clearLegacyCredentials();
  try {
    const response = await fetch('/api/auth', {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!response.ok) return { authenticated: false };
    const data = (await response.json()) as {
      authenticated?: boolean;
      user?: { username?: string };
    };
    return {
      authenticated: data.authenticated === true,
      username: data.user?.username,
    };
  } catch {
    return { authenticated: false };
  }
}

export async function logoutServerSession(): Promise<void> {
  try {
    await fetch('/api/auth', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
  } finally {
    setUserAuthenticated(null);
  }
}

export function getAuthenticatedUsername(): string | null {
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEY);
  } catch {
    return null;
  }
}

export function setUserAuthenticated(username: string | null): void {
  try {
    if (username) {
      sessionStorage.setItem(AUTH_SESSION_KEY, username);
      sessionStorage.setItem('portfolio-owner-unlocked-session', '1');
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem('portfolio-owner-unlocked-session');
      sessionStorage.removeItem(LEGACY_CLOUD_TOKEN_KEY);
    }
  } catch {}
}
