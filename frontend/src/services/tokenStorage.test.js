import test from 'node:test';
import assert from 'node:assert/strict';

// Mock localStorage for Node test runner
const storage = new Map();
global.localStorage = {
  getItem: (key) => storage.get(key) || null,
  setItem: (key, val) => storage.set(key, String(val)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

const {
  AUTH_TOKEN_KEY,
  LEGACY_TOKEN_KEYS,
  getStoredToken,
  setStoredToken,
  clearStoredToken
} = await import('./tokenStorage.js');

test('setStoredToken stores to canonical key and purges legacy keys', () => {
  localStorage.setItem('terranav_jwt_token', 'old_jwt');
  localStorage.setItem('terranav_token', 'old_token');

  setStoredToken('new_canonical_jwt_token');

  assert.equal(localStorage.getItem(AUTH_TOKEN_KEY), 'new_canonical_jwt_token');
  assert.equal(localStorage.getItem('terranav_jwt_token'), null);
  assert.equal(localStorage.getItem('terranav_token'), null);
});

test('getStoredToken retrieves canonical token directly', () => {
  localStorage.clear();
  localStorage.setItem(AUTH_TOKEN_KEY, 'token_xyz');

  const token = getStoredToken();
  assert.equal(token, 'token_xyz');
});

test('getStoredToken migrates legacy terranav_jwt_token transparently', () => {
  localStorage.clear();
  localStorage.setItem('terranav_jwt_token', 'legacy_token_123');

  const token = getStoredToken();
  assert.equal(token, 'legacy_token_123');
  // Should now be migrated into canonical key
  assert.equal(localStorage.getItem(AUTH_TOKEN_KEY), 'legacy_token_123');
  // Legacy key should be removed
  assert.equal(localStorage.getItem('terranav_jwt_token'), null);
});

test('clearStoredToken purges canonical and all legacy keys', () => {
  localStorage.setItem(AUTH_TOKEN_KEY, 'active_token');
  localStorage.setItem('terranav_jwt_token', 'stale1');
  localStorage.setItem('terranav_token', 'stale2');

  clearStoredToken();

  assert.equal(localStorage.getItem(AUTH_TOKEN_KEY), null);
  assert.equal(localStorage.getItem('terranav_jwt_token'), null);
  assert.equal(localStorage.getItem('terranav_token'), null);
});
