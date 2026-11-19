/**
 * JWT configuration guardrails for production vs test profiles.
 */
const assert = require('assert');
const path = require('path');

function loadAuthModule(env) {
  const keys = ['JWT_SECRET', 'NODE_ENV'];
  const saved = {};
  keys.forEach((key) => { saved[key] = process.env[key]; });
  Object.assign(process.env, env);
  const modulePath = path.resolve(__dirname, '../api/_lib/auth.js');
  delete require.cache[modulePath];
  const auth = require(modulePath);
  keys.forEach((key) => {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  });
  delete require.cache[modulePath];
  return auth;
}

let passed = 0;
let failed = 0;

function check(condition, name) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    failed += 1;
  }
}

console.log('\n[Auth Config Tests]');

try {
  loadAuthModule({ NODE_ENV: 'production', JWT_SECRET: 'short' });
  check(false, 'Production rejects weak JWT secret');
} catch (err) {
  check(String(err.message).includes('JWT_SECRET'), 'Production rejects weak JWT secret');
}

try {
  const auth = loadAuthModule({
    NODE_ENV: 'production',
    JWT_SECRET: 'x'.repeat(40)
  });
  check(typeof auth.generateToken === 'function', 'Production accepts strong configured JWT secret');
} catch (err) {
  check(false, `Production accepts strong configured JWT secret (${err.message})`);
}

try {
  const auth = loadAuthModule({ NODE_ENV: 'test' });
  const token = auth.generateToken({ id: 1, username: 't', email: 't@example.com' });
  const decoded = auth.verifyToken(token);
  check(decoded.id === 1, 'Test profile can issue and verify JWT tokens');

  let noHeaderNext = null;
  auth.optionalAuth({ headers: {} }, {}, (err) => { noHeaderNext = err || null; });
  check(noHeaderNext === null, 'Optional auth permits an absent Authorization header');

  let invalidTokenNext = null;
  auth.optionalAuth(
    { headers: { authorization: 'Bearer invalid-token' } },
    {},
    (err) => { invalidTokenNext = err || null; }
  );
  check(
    invalidTokenNext && invalidTokenNext.statusCode === 401,
    'Optional auth rejects an invalid bearer token instead of downgrading it to anonymous'
  );
} catch (err) {
  check(false, `Test profile JWT round-trip (${err.message})`);
}

try {
  loadAuthModule({ NODE_ENV: 'development', JWT_SECRET: 'terranav_ai_jwt_super_secret_key_2026_production_change_me' });
  check(false, 'Development rejects known placeholder JWT secret');
} catch (err) {
  check(String(err.message).includes('known weak placeholder'), 'Development rejects known placeholder JWT secret');
}

try {
  loadAuthModule({ NODE_ENV: 'development', JWT_SECRET: 'too-short-dev-secret' });
  check(false, 'Development rejects short (<32 chars) JWT secret');
} catch (err) {
  check(String(err.message).includes('at least 32 characters'), 'Development rejects short (<32 chars) JWT secret');
}

try {
  const auth = loadAuthModule({ NODE_ENV: 'development', JWT_SECRET: 'a'.repeat(32) });
  check(typeof auth.generateToken === 'function', 'Development accepts strong unique JWT secret');
} catch (err) {
  check(false, `Development accepts strong unique JWT secret (${err.message})`);
}

console.log(`Auth config tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
