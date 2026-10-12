/**
 * TerraNav AI — Automated Integration Test Suite
 * Member 3: Backend Integration, Microservices & Data Layer
 */

const http = require('http');
const { app } = require('../api/server');

let server;
const PORT = 5099; // Dedicated test port
let baseUrl = `http://localhost:${PORT}`;

let authToken = '';
let savedPlaceId = null;
let historyId = null;
let incidentId = null;

let passedCount = 0;
let failedCount = 0;

function runRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, testName, extra = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${extra}`);
    failedCount++;
  }
}

async function runTests() {
  console.log('\n========================================================');
  console.log('  TerraNav AI — Member 3 Integration Test Suite');
  console.log('========================================================\n');

  // Start temporary server
  await new Promise(resolve => {
    server = app.listen(PORT, resolve);
  });

  try {
    // --------------------------------------------------------------------------
    // LEVEL 1: Health & System Gateway
    // --------------------------------------------------------------------------
    console.log('[Level 1: System Health]');
    const health = await runRequest('GET', '/api/health');
    assert(health.status === 200, 'GET /api/health returns HTTP 200');
    assert(health.data.success === true, 'GET /api/health success is true');
    assert(health.data.data.service === 'terranav-backend', 'Service identifies as terranav-backend');
    assert(health.data.data.database !== undefined, 'Database pool status is reported');

    // --------------------------------------------------------------------------
    // LEVEL 2: Authentication
    // --------------------------------------------------------------------------
    console.log('\n[Level 2: JWT Authentication]');
    const uniqueUser = `agent_${Date.now()}`;
    const registerRes = await runRequest('POST', '/api/auth/register', {
      username: uniqueUser,
      email: `${uniqueUser}@terranav.ai`,
      password: 'Password123!'
    });
    assert(registerRes.status === 201, 'POST /api/auth/register returns HTTP 201');
    assert(registerRes.data.data.token !== undefined, 'Registration returns JWT token');
    assert(registerRes.data.data.user.username === uniqueUser, 'Registration returns user record without password');

    // Login
    const loginRes = await runRequest('POST', '/api/auth/login', {
      email: `${uniqueUser}@terranav.ai`,
      password: 'Password123!'
    });
    assert(loginRes.status === 200, 'POST /api/auth/login returns HTTP 200');
    assert(loginRes.data.data.token !== undefined, 'Login returns JWT token');
    authToken = loginRes.data.data.token;

    // Profile /me
    const meRes = await runRequest('GET', '/api/auth/me', null, authToken);
    assert(meRes.status === 200, 'GET /api/auth/me returns HTTP 200 with Bearer token');
    assert(meRes.data.data.user.email === `${uniqueUser}@terranav.ai`, 'Me endpoint matches authenticated user');

    // --------------------------------------------------------------------------
    // LEVEL 3: Saved Places CRUD
    // --------------------------------------------------------------------------
    console.log('\n[Level 3: Saved Places CRUD]');
    const createPlaceRes = await runRequest('POST', '/api/saved', {
      name: 'Indiranagar Metro',
      latitude: 12.9784,
      longitude: 77.6408,
      address: 'CMH Road, Indiranagar',
      category: 'work'
    }, authToken);
    assert(createPlaceRes.status === 201, 'POST /api/saved returns HTTP 201');
    assert(createPlaceRes.data.data.id !== undefined, 'Saved place created with ID');
    savedPlaceId = createPlaceRes.data.data.id;

    const listPlacesRes = await runRequest('GET', '/api/saved', null, authToken);
    assert(listPlacesRes.status === 200, 'GET /api/saved returns HTTP 200');
    assert(Array.isArray(listPlacesRes.data.data), 'Saved places list is an array');
    assert(listPlacesRes.data.data.length >= 1, 'Saved places list contains created place');

    const getPlaceRes = await runRequest('GET', `/api/saved/${savedPlaceId}`, null, authToken);
    assert(getPlaceRes.status === 200, 'GET /api/saved/:id returns HTTP 200');
    assert(getPlaceRes.data.data.name === 'Indiranagar Metro', 'Saved place name matches');

    const updatePlaceRes = await runRequest('PUT', `/api/saved/${savedPlaceId}`, {
      name: 'Indiranagar Metro Hub',
      latitude: 12.9784,
      longitude: 77.6408,
      address: 'CMH Road, Indiranagar',
      category: 'favorite'
    }, authToken);
    assert(updatePlaceRes.status === 200, 'PUT /api/saved/:id returns HTTP 200');
    assert(updatePlaceRes.data.data.name === 'Indiranagar Metro Hub', 'Saved place name updated');

    const deletePlaceRes = await runRequest('DELETE', `/api/saved/${savedPlaceId}`, null, authToken);
    assert(deletePlaceRes.status === 200, 'DELETE /api/saved/:id returns HTTP 200');

    // --------------------------------------------------------------------------
    // LEVEL 4: Route History
    // --------------------------------------------------------------------------
    console.log('\n[Level 4: Route History]');
    const logHistoryRes = await runRequest('POST', '/api/history', {
      origin_lat: 12.9756,
      origin_lng: 77.6066,
      origin_name: 'MG Road',
      dest_lat: 12.9352,
      dest_lng: 77.6245,
      dest_name: 'Koramangala',
      transport_mode: 'car',
      total_distance_meters: 6850,
      total_duration_seconds: 1120,
      traditional_duration_seconds: 1480,
      time_saved_seconds: 360
    }, authToken);
    assert(logHistoryRes.status === 201, 'POST /api/history returns HTTP 201');
    historyId = logHistoryRes.data.data.id;

    const listHistoryRes = await runRequest('GET', '/api/history', null, authToken);
    assert(listHistoryRes.status === 200, 'GET /api/history returns HTTP 200');
    assert(listHistoryRes.data.data.length >= 1, 'Route history list contains logged route');

    // --------------------------------------------------------------------------
    // LEVEL 5: Incidents
    // --------------------------------------------------------------------------
    console.log('\n[Level 5: Incident Logging & Reporting]');
    const createIncRes = await runRequest('POST', '/api/incidents', {
      chunkId: 'CHUNK_104',
      type: 'accident',
      description: 'Minor fender bender on right lane',
      latitude: 12.9550,
      longitude: 77.6050
    }, authToken);
    assert(createIncRes.status === 201, 'POST /api/incidents returns HTTP 201');
    incidentId = createIncRes.data.data.id;

    const listIncRes = await runRequest('GET', '/api/incidents');
    assert(listIncRes.status === 200, 'GET /api/incidents returns HTTP 200');
    assert(listIncRes.data.data.length >= 1, 'Incidents list is populated');

    // --------------------------------------------------------------------------
    // LEVEL 6: Central Dynamic Directions Integration
    // --------------------------------------------------------------------------
    console.log('\n[Level 6: Dynamic Directions & ML / Routing Integration]');
    
    // Test 6A: Standard Route
    const routeRes = await runRequest('POST', '/api/directions/dynamic', {
      origin: { lat: 12.9756, lng: 77.6066 },
      destination: { lat: 12.9352, lng: 77.6245 },
      mode: 'car'
    }, authToken);
    assert(routeRes.status === 200, 'POST /api/directions/dynamic returns HTTP 200');
    assert(routeRes.data.summary !== undefined, 'Response contains summary block');
    assert(routeRes.data.summary.totalDistanceMeters > 0, 'totalDistanceMeters is computed');
    assert(routeRes.data.summary.totalDurationSeconds > 0, 'totalDurationSeconds is computed');
    assert(routeRes.data.summary.traditionalDurationSeconds >= routeRes.data.summary.totalDurationSeconds, 'Traditional ETA >= Dynamic ETA');
    assert(Array.isArray(routeRes.data.chunks), 'Response contains chunks array');
    assert(routeRes.data.chunks.length > 0, 'Corridor decomposed into 200-500m chunks');
    assert(routeRes.data.chunks[0].predictedSpeedKmh > 0, 'Chunk has ML predicted speed');
    assert(routeRes.data.chunks[0].color !== undefined, 'Chunk has congestion color token');
    assert(Array.isArray(routeRes.data.steps), 'Response contains navigation steps');

    // Test 6B: Incident Simulation Rerouting
    const incidentRouteRes = await runRequest('POST', '/api/directions/dynamic', {
      origin: { lat: 12.9756, lng: 77.6066 },
      destination: { lat: 12.9352, lng: 77.6245 },
      mode: 'car',
      simulatedIncident: {
        chunkId: 'CHUNK_104',
        type: 'roadblock'
      }
    });
    assert(incidentRouteRes.status === 200, 'Dynamic route with roadblock incident succeeds');
    assert(incidentRouteRes.data.summary.totalDistanceMeters > 0, 'Rerouted path solved around roadblock');

    // Test 6C: Motorcycle Mode Filtering
    const motoRouteRes = await runRequest('POST', '/api/directions/dynamic', {
      origin: { lat: 12.9756, lng: 77.6066 },
      destination: { lat: 12.9352, lng: 77.6245 },
      mode: 'motorcycle'
    });
    assert(motoRouteRes.status === 200, 'Motorcycle mode dynamic route succeeds');
    assert(motoRouteRes.data.summary.mode === 'motorcycle', 'Mode reflects motorcycle profile');

    // --------------------------------------------------------------------------
    // LEVEL 7: External Services
    // --------------------------------------------------------------------------
    console.log('\n[Level 7: External Services (Nominatim, Overpass, Fallback)]');
    const geocodeRes = await runRequest('GET', '/api/services/geocode?q=Koramangala&limit=2');
    assert(geocodeRes.status === 200, 'GET /api/services/geocode returns HTTP 200');

    const reverseRes = await runRequest('GET', '/api/services/reverse?lat=12.9756&lng=77.6066');
    assert(reverseRes.status === 200, 'GET /api/services/reverse returns HTTP 200');

    const poiRes = await runRequest('GET', '/api/services/poi?lat=12.9756&lng=77.6066&radius=1000');
    assert(poiRes.status === 200, 'GET /api/services/poi returns HTTP 200');

    // --------------------------------------------------------------------------
    // LEVEL 8: Negative & Error Handling Tests
    // --------------------------------------------------------------------------
    console.log('\n[Level 8: Negative Tests & Error Guardrails]');
    const badCoordRes = await runRequest('POST', '/api/directions/dynamic', {
      origin: { lat: 999.0, lng: 77.5946 },
      destination: { lat: 12.9352, lng: 77.6245 }
    });
    assert(badCoordRes.status === 400, 'Negative: Invalid latitude returns HTTP 400 Bad Request');

    const noAuthRes = await runRequest('GET', '/api/auth/me');
    assert(noAuthRes.status === 401, 'Negative: Missing token returns HTTP 401 Unauthorized');

    const badAuthRes = await runRequest('GET', '/api/auth/me', null, 'fake_invalid_token');
    assert(badAuthRes.status === 401, 'Negative: Malformed token returns HTTP 401 Unauthorized');

    const notFoundRes = await runRequest('GET', '/api/saved/99999', null, authToken);
    assert(notFoundRes.status === 404, 'Negative: Non-existent saved place returns HTTP 404 Not Found');

    console.log('\n========================================================');
    console.log(`  Tests Completed: ${passedCount + failedCount}`);
    console.log(`  Passed: ${passedCount}`);
    console.log(`  Failed: ${failedCount}`);
    console.log('========================================================\n');

  } catch (err) {
    console.error('Fatal test runner error:', err);
    failedCount++;
  } finally {
    server.close();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
