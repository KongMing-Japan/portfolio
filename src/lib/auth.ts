/**
 * User Account Authentication & Credentials Management
 * Supports standard username/password forms for Chrome Password Manager autofill and saving.
 */

export interface UserAccount {
  username: string;
  passwordHash: string; // SHA-256
  createdAt: string;
}

const USER_ACCOUNT_STORAGE_KEY = 'portfolio-user-account-v2';
const AUTH_SESSION_KEY = 'portfolio-auth-session-v2';

export const DEFAULT_USER = {
  username: 'owner',
  defaultPassword: '888888',
};

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getRegisteredUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(USER_ACCOUNT_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserAccount;
    }
  } catch {}
  return null;
}

export async function registerOrUpdateUser(
  username: string,
  password: string,
): Promise<UserAccount> {
  const cleanUsername = username.trim() || DEFAULT_USER.username;
  const passwordHash = await sha256(password);
  const account: UserAccount = {
    username: cleanUsername,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(USER_ACCOUNT_STORAGE_KEY, JSON.stringify(account));
  return account;
}

export async function verifyUserCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const cleanUsername = username.trim();
  const registered = getRegisteredUser();

  if (registered) {
    if (registered.username.toLowerCase() !== cleanUsername.toLowerCase()) {
      return false;
    }
    const hash = await sha256(password);
    return hash === registered.passwordHash;
  }

  // Initial out-of-the-box fallback
  if (
    cleanUsername.toLowerCase() === DEFAULT_USER.username &&
    password === DEFAULT_USER.defaultPassword
  ) {
    // Automatically save it so it becomes the registered user
    await registerOrUpdateUser(DEFAULT_USER.username, DEFAULT_USER.defaultPassword);
    return true;
  }

  // Allow first-time custom setup: if not registered yet, any non-empty user/pass can establish the account
  if (!registered && cleanUsername && password.length >= 4) {
    await registerOrUpdateUser(cleanUsername, password);
    return true;
  }

  return false;
}

export function isUserAuthenticated(): boolean {
  try {
    const session = sessionStorage.getItem(AUTH_SESSION_KEY);
    return Boolean(session && session.length > 0);
  } catch {
    return false;
  }
}

export function getAuthenticatedUsername(): string | null {
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEY) || null;
  } catch {
    return null;
  }
}

export function setUserAuthenticated(username: string | null): void {
  try {
    if (username) {
      sessionStorage.setItem(AUTH_SESSION_KEY, username);
      // Legacy session compatibility
      sessionStorage.setItem('portfolio-owner-unlocked-session', '1');
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem('portfolio-owner-unlocked-session');
    }
  } catch {}
}
