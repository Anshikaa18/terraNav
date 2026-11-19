/**
 * Regression: clearing route history must remove only the requested user's rows.
 * This is deliberately service-level: it is deterministic and needs no loopback
 * listener, while API routing is exercised by the integration suite.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
process.env.ALLOW_IN_MEMORY_DB = 'true';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'terranav-test-jwt-secret-32chars-min';

const authService = require('../api/auth/service');
const historyService = require('../api/history/service');

const route = (offset) => ({
  origin_lat: 12.97 + offset,
  origin_lng: 77.59,
  dest_lat: 12.93 + offset,
  dest_lng: 77.62,
  transport_mode: 'car',
  total_distance_meters: 1000,
  total_duration_seconds: 120,
  traditional_duration_seconds: 150,
  time_saved_seconds: 30
});

async function main() {
  try {
    const stamp = Date.now();
    const userA = await authService.register({
      username: `hist_a_${stamp}`,
      email: `hist_a_${stamp}@terranav.ai`,
      password: 'Password123!'
    });
    const userB = await authService.register({
      username: `hist_b_${stamp}`,
      email: `hist_b_${stamp}@terranav.ai`,
      password: 'Password123!'
    });

    await historyService.logRouteHistory(userA.user.id, route(0));
    await historyService.logRouteHistory(userB.user.id, route(0.01));
    const clearResult = await historyService.clearRouteHistory(userA.user.id);
    const [aRows, bRows] = await Promise.all([
      historyService.listRouteHistory(userA.user.id),
      historyService.listRouteHistory(userB.user.id)
    ]);

    if (clearResult.count !== 1) throw new Error(`expected to clear 1 row, cleared ${clearResult.count}`);
    if (aRows.length !== 0) throw new Error(`user A history not cleared (${aRows.length})`);
    if (bRows.length !== 1) throw new Error(`user B history incorrectly changed (${bRows.length})`);
    console.log('  ✓ PASS: history clear removes only the requested user entries');
  } catch (err) {
    console.error(`  ✗ FAIL: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
