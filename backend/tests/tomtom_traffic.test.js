const assert = require('assert');
const axios = require('axios');
const tomtom = require('../api/traffic/tomtomAdapter');

const routes = [{ geometry: { coordinates: [[81.6290, 21.2510], [81.6350, 21.2520]] } }];
const originalGet = axios.get;

async function run() {
  let passed = 0;
  const check = (condition, name) => { assert.ok(condition, name); console.log(`  ✓ PASS: ${name}`); passed += 1; };
  try {
    const saved = process.env.TOMTOM_API_KEY;
    delete process.env.TOMTOM_API_KEY;
    const missing = await tomtom.getFlowForRoutes(routes);
    check(missing.status === 'unavailable' && missing.observationCount === 0, 'missing TomTom key never reports live traffic');
    process.env.TOMTOM_API_KEY = 'test-key';
    tomtom.clearCache();

    axios.get = async (url) => {
      if (url.includes('incident')) return { data: { incidents: [] } };
      return { data: { flowSegmentData: { currentSpeed: 24, freeFlowSpeed: 48, confidence: 0.9, coordinates: { coordinate: [{ latitude: 21.251, longitude: 81.629 }, { latitude: 21.252, longitude: 81.635 }] } } } };
    };
    const live = await tomtom.getFlowForRoutes(routes);
    check(live.status === 'live' && live.observationCount > 0 && live.observations[0].observedSpeedKmh === 24, 'usable TomTom speed/free-flow response is live');

    const realNow = Date.now;
    Date.now = () => realNow() + tomtom.MAX_FRESH_AGE_MS + 1;
    axios.get = async () => { const error = new Error('provider offline'); error.code = 'ECONNRESET'; throw error; };
    const stale = await tomtom.getFlowForRoutes(routes);
    Date.now = realNow;
    check(stale.status === 'stale' && stale.stale === true, 'expired cached observation is stale and not live');

    tomtom.clearCache();
    axios.get = async (url) => url.includes('incident') ? { data: { incidents: [] } } : { data: { flowSegmentData: { currentSpeed: 20, freeFlowSpeed: 40 } } };
    const noGeometry = await tomtom.getFlowForRoutes(routes);
    check(noGeometry.status === 'unavailable', 'point-only response is not falsely matched as live traffic');

    tomtom.clearCache();
    axios.get = async () => { const error = new Error('rate limited'); error.response = { status: 429 }; throw error; };
    const limited = await tomtom.getFlowForRoutes(routes);
    check(limited.status === 'error' && limited.errorType === 'RATE_LIMIT', 'TomTom rate limit produces explicit error status');
    if (saved === undefined) delete process.env.TOMTOM_API_KEY; else process.env.TOMTOM_API_KEY = saved;
    console.log(`TomTom traffic checks passed: ${passed}`);
  } finally { axios.get = originalGet; }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
