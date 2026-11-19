/**
 * ChunkFlow AI — Secure Token Storage Service
 * Consolidates auth tokens into a single canonical key and migrates legacy keys.
 */

export const AUTH_TOKEN_KEY = 'chunkflow_auth_token';
export const LEGACY_TOKEN_KEYS = ['terranav_jwt_token', 'terranav_token'];

/**
 * Get active auth token from canonical storage, migrating legacy keys if found.
 */
export function getStoredToken() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) return token;

    for (const legacyKey of LEGACY_TOKEN_KEYS) {
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        localStorage.setItem(AUTH_TOKEN_KEY, legacy);
        localStorage.removeItem(legacyKey);
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist authenticated token to canonical storage and remove duplicate legacy keys.
 */
export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
      for (const legacyKey of LEGACY_TOKEN_KEYS) {
        localStorage.removeItem(legacyKey);
      }
    }
  } catch (err) {
    console.warn('Failed to persist auth token:', err);
  }
}

/**
 * Purge all auth tokens across canonical and legacy storage.
 */
export function clearStoredToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    for (const legacyKey of LEGACY_TOKEN_KEYS) {
      localStorage.removeItem(legacyKey);
    }
  } catch {
    // Ignore storage errors on logout
  }
}
