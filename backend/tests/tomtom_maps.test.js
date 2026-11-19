const assert = require('assert');
const axios = require('axios');
const maps = require('../api/maps/controller');

async function run() {
  const originalGet = axios.get;
  const savedKey = process.env.TOMTOM_API_KEY;
  process.env.TOMTOM_API_KEY = 'test-key';
  let passed = 0;
  const check = (condition, name) => { assert.ok(condition, name); console.log(`  ✓ PASS: ${name}`); passed += 1; };

  try {
    check(maps.validTileCoordinate(14, 11800, 7200), 'valid TomTom XYZ coordinates are accepted');
    check(!maps.validTileCoordinate(23, 0, 0) && !maps.validTileCoordinate(14, -1, 0), 'out-of-range tile coordinates are rejected');

    let requestedUrl = '';
    axios.get = async (url) => { requestedUrl = url; return { data: Uint8Array.from([137, 80, 78, 71]), headers: { 'content-type': 'image/png' } }; };
    const headers = {};
    const response = { setHeader: (name, value) => { headers[name] = value; }, status: () => response, send: (body) => { response.body = body; } };
    let nextError = null;
    await maps.tomtomTile({ params: { z: '14', x: '11800', y: '7200' } }, response, (error) => { nextError = error; });
    check(!nextError && requestedUrl.includes('/14/11800/7200.png') && headers['Content-Type'] === 'image/png' && Buffer.isBuffer(response.body), 'TomTom map tile is proxied without exposing its key');

    nextError = null;
    await maps.tomtomTile({ params: { z: '23', x: '0', y: '0' } }, response, (error) => { nextError = error; });
    check(nextError?.statusCode === 400, 'invalid tile request receives a clear validation error');
    console.log(`TomTom map checks passed: ${passed}`);
  } finally {
    axios.get = originalGet;
    if (savedKey === undefined) delete process.env.TOMTOM_API_KEY; else process.env.TOMTOM_API_KEY = savedKey;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
