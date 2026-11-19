/**
 * Regression Test Suite: Incident Authentication and Authorization (SEC-002, SEC-003)
 * Tests:
 * 1. Anonymous creation is rejected (401)
 * 2. Authenticated user can create incident (201)
 * 3. Cross-user status modification is forbidden (403)
 * 4. Cross-user deletion is forbidden (403)
 * 5. Owner can modify status (200)
 * 6. Owner can delete incident (200)
 * 7. Invalid coordinates or payloads return 400
 */

process.env.NODE_ENV = 'test';
process.env.ALLOW_IN_MEMORY_DB = 'true';

const assert = require('assert');
const http = require('http');
const { app } = require('../api/server');
const { generateToken } = require('../api/_lib/auth');

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

function runRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      'Content-Type': 'application/json'
    };
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

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
          try {
            const data = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode, headers: res.headers, data });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;

  console.log('\n[Incident Auth & Authorization Regression Suite]');

  const userA = { id: 101, username: 'alice', email: 'alice@example.com' };
  const userB = { id: 102, username: 'bob', email: 'bob@example.com' };

  const tokenA = generateToken(userA);
  const tokenB = generateToken(userB);

  // 1. Anonymous creation rejected
  const anonCreate = await runRequest('POST', '/api/incidents', {
    chunkId: 'CHUNK_101',
    type: 'accident',
    latitude: 12.9716,
    longitude: 77.5946,
    description: 'Anonymous report'
  });
  check(anonCreate.status === 401, 'Anonymous incident creation rejected with HTTP 401');

  // 2. User A creates incident
  const aliceCreate = await runRequest('POST', '/api/incidents', {
    chunkId: 'CHUNK_102',
    type: 'accident',
    latitude: 12.9716,
    longitude: 77.5946,
    description: 'Fender bender reported by Alice'
  }, tokenA);
  check(aliceCreate.status === 201, 'Authenticated User A can report incident (HTTP 201)');
  const incidentId = aliceCreate.data.data.id;
  check(aliceCreate.data.data.reportedBy === 101, 'Incident records User A as reportedBy');

  // 3. User B attempts to change status of User A's incident -> 403 Forbidden
  const bobUpdate = await runRequest('PUT', `/api/incidents/${incidentId}/status`, {
    status: 'cleared'
  }, tokenB);
  check(bobUpdate.status === 403, 'Cross-user status update rejected with HTTP 403 Forbidden');

  // 4. User B attempts to delete User A's incident -> 403 Forbidden
  const bobDelete = await runRequest('DELETE', `/api/incidents/${incidentId}`, null, tokenB);
  check(bobDelete.status === 403, 'Cross-user deletion rejected with HTTP 403 Forbidden');

  // 5. User A can update status of their own incident -> 200 OK
  const aliceUpdate = await runRequest('PUT', `/api/incidents/${incidentId}/status`, {
    status: 'cleared'
  }, tokenA);
  check(aliceUpdate.status === 200, 'Owner (User A) can update status to cleared (HTTP 200)');
  check(aliceUpdate.data.data.status === 'cleared', 'Returned incident status is cleared');

  // 6. User A can delete their own incident -> 200 OK
  const aliceDelete = await runRequest('DELETE', `/api/incidents/${incidentId}`, null, tokenA);
  check(aliceDelete.status === 200, 'Owner (User A) can delete incident (HTTP 200)');

  // 7. Input validation: invalid coordinates rejected
  const badCoords = await runRequest('POST', '/api/incidents', {
    chunkId: 'CHUNK_103',
    type: 'accident',
    latitude: 999,
    longitude: 77.5946
  }, tokenA);
  check(badCoords.status === 400, 'Invalid latitude (>90) rejected with HTTP 400');

  // 8. Input validation: invalid severity rejected
  const badSeverity = await runRequest('POST', '/api/incidents', {
    chunkId: 'CHUNK_103',
    type: 'accident',
    severity: 'apocalyptic'
  }, tokenA);
  check(badSeverity.status === 400, 'Invalid severity value rejected with HTTP 400');

  // 9. Input validation: overlong description rejected
  const badDesc = await runRequest('POST', '/api/incidents', {
    chunkId: 'CHUNK_103',
    type: 'accident',
    description: 'x'.repeat(501)
  }, tokenA);
  check(badDesc.status === 400, 'Description exceeding 500 characters rejected with HTTP 400');

  server.close();
  console.log(`\nIncident auth suite: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Fatal in test suite:', err);
  if (server) server.close();
  process.exit(1);
});
