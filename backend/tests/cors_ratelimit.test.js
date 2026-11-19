/**
 * Regression Test Suite: CORS Hardening and Rate Limiter Proxy Trust (SEC-004, SEC-005)
 */

process.env.NODE_ENV = 'test';
process.env.ALLOW_IN_MEMORY_DB = 'true';
process.env.CORS_ORIGIN = 'http://localhost:5173,http://localhost:3000';

const assert = require('assert');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { app } = require('../api/server');
const { createRateLimiter, resetAllBuckets } = require('../api/_lib/rateLimit');

let server;
let port;
let passed = 0;
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed += 1;
  }
}

function runRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: raw });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;

  console.log('\n[CORS & Rate Limiting Security Regression Suite]');

  // --- 1. CORS Tests ---
  // A. Allowed Origin
  const allowedRes = await runRequest('GET', '/api/health', {
    Origin: 'http://localhost:5173'
  });
  check(allowedRes.status === 200, 'GET /api/health with allowed origin returns HTTP 200');
  check(
    allowedRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
    'Allowed origin is reflected in Access-Control-Allow-Origin header'
  );
  check(
    allowedRes.headers['access-control-allow-credentials'] === 'true',
    'Access-Control-Allow-Credentials is set to true for allowed origin'
  );
  check(
    allowedRes.headers['permissions-policy']?.includes('geolocation=(self)'),
    'Same-origin location permission remains enabled for the map and directions controls'
  );

  // B. Disallowed Origin
  const evilRes = await runRequest('GET', '/api/health', {
    Origin: 'http://evil-attacker.com'
  });
  check(
    !evilRes.headers['access-control-allow-origin'],
    'Disallowed origin does NOT receive Access-Control-Allow-Origin header'
  );

  // C. Preflight OPTIONS for allowed origin
  const preflightRes = await runRequest('OPTIONS', '/api/directions/dynamic', {
    Origin: 'http://localhost:5173',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type, Authorization'
  });
  check(
    preflightRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
    'Preflight for allowed origin succeeds with Access-Control-Allow-Origin'
  );
  check(
    preflightRes.headers['access-control-allow-credentials'] === 'true',
    'Preflight sets Access-Control-Allow-Credentials: true'
  );

  // --- 2. Rate Limiting & Spoofed Header Tests ---
  // Create an isolated sub-app to test rate limiter behavior with untrusted headers
  const rateLimitApp = express();
  // Do NOT trust proxy on this test app (standard default direct internet exposure)
  const testLimiter = createRateLimiter({ windowMs: 10_000, max: 2, name: 'test-limit' });
  rateLimitApp.use(testLimiter);
  rateLimitApp.get('/test-route', (req, res) => res.json({ ok: true }));

  const rateLimitServer = rateLimitApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => rateLimitServer.once('listening', resolve));
  const ratePort = rateLimitServer.address().port;

  resetAllBuckets();

  function testReq(spoofedIp) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: ratePort,
          path: '/test-route',
          method: 'GET',
          headers: {
            'X-Forwarded-For': spoofedIp
          }
        },
        (res) => {
          let raw = '';
          res.on('data', (c) => { raw += c; });
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  // Request 1: with spoofed IP A
  const r1 = await testReq('198.51.100.1');
  check(r1.status === 200, 'First request passes rate limit');

  // Request 2: with spoofed IP B
  const r2 = await testReq('198.51.100.2');
  check(r2.status === 200, 'Second request passes rate limit');

  // Request 3: with spoofed IP C (Attacker attempting to bypass limit by rotating X-Forwarded-For)
  const r3 = await testReq('198.51.100.3');
  check(
    r3.status === 429,
    'Third request fails with HTTP 429: spoofed X-Forwarded-For does not bypass rate limit'
  );
  check(
    r3.headers['retry-after'] !== undefined,
    'Rate limit rejection includes Retry-After header'
  );

  rateLimitServer.close();
  server.close();

  console.log(`\nCORS and rate limit suite: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  if (server) server.close();
  process.exit(1);
});
