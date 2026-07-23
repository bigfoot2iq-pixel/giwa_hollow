import { XUserData, XAuthSession } from '@/lib/supabase/types';

const X_AUTH_STORAGE_KEY = 'x_auth_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a random state string for OAuth security
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);

  // Use Web Crypto API (available in both browser and Node.js 15+)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else if (typeof window === 'undefined') {
    // Fallback for older Node.js versions
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(array);
  }

  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store X auth session in localStorage
 */
export function storeXAuthSession(userData: XUserData): void {
  if (typeof window === 'undefined') return;

  try {
    const session: XAuthSession = {
      user: userData,
      authenticated: true,
      timestamp: Date.now()
    };

    localStorage.setItem(X_AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to store X auth session:', error);
  }
}

/**
 * Retrieve X auth session from localStorage
 */
export function getXAuthSession(): XAuthSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(X_AUTH_STORAGE_KEY);
    if (!stored) return null;

    const session: XAuthSession = JSON.parse(stored);

    // Check if session is expired
    if (Date.now() - session.timestamp > SESSION_DURATION) {
      clearXAuthSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to retrieve X auth session:', error);
    return null;
  }
}

/**
 * Clear X auth session from localStorage
 */
export function clearXAuthSession(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(X_AUTH_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear X auth session:', error);
  }
}

/**
 * Check if user is authenticated with X
 */
export function isXAuthenticated(): boolean {
  const session = getXAuthSession();
  return session?.authenticated === true;
}

/**
 * Get current X user data
 */
export function getXUserData(): XUserData | null {
  const session = getXAuthSession();
  return session?.user || null;
}

/**
 * Store OAuth state in sessionStorage for verification
 */
export function storeOAuthState(state: string): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem('oauth_state', state);
  } catch (error) {
    console.error('Failed to store OAuth state:', error);
  }
}

/**
 * Verify OAuth state from sessionStorage
 */
export function verifyOAuthState(state: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const storedState = sessionStorage.getItem('oauth_state');
    sessionStorage.removeItem('oauth_state'); // Clean up
    return storedState === state;
  } catch (error) {
    console.error('Failed to verify OAuth state:', error);
    return false;
  }
} 