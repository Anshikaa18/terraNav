const assert = require('assert');
const controller = require('../api/directions/controller');
const directionsService = require('../api/directions/service');

async function invoke(token) {
  const req = {
    body: { updates: [{ u: 'A', v: 'B', speed_kmh: 20, source: 'fixture', observed_at: new Date().toISOString() }] },
    get: name => name.toLowerCase() === 'x-terranav-traffic-token' ? token : undefined
  };
  const result = { statusCode: 200, body: null };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; }
  };
  let forwarded;
  await controller.updateTraffic(req, res, error => { forwarded = error; });
  return { result, forwarded };
}

async function run() {
  const savedToken = process.env.TERRANAV_TRAFFIC_UPDATE_TOKEN;
  const originalUpdate = directionsService.updateGraphTraffic;
  try {
    delete process.env.TERRANAV_TRAFFIC_UPDATE_TOKEN;
    let response = await invoke('');
    assert.equal(response.forwarded.statusCode, 503, 'unconfigured ingestion is disabled');

    process.env.TERRANAV_TRAFFIC_UPDATE_TOKEN = 'a-long-test-only-ingestion-secret';
    response = await invoke('wrong-token');
    assert.equal(response.forwarded.statusCode, 401, 'invalid token is rejected');

    directionsService.updateGraphTraffic = async updates => ({ ok: true, updated_edges: updates.length });
    response = await invoke(process.env.TERRANAV_TRAFFIC_UPDATE_TOKEN);
    assert.equal(response.result.statusCode, 200);
    assert.deepEqual(response.result.body, { ok: true, updated_edges: 1 });
    console.log('Traffic update authentication checks passed');
  } finally {
    directionsService.updateGraphTraffic = originalUpdate;
    if (savedToken === undefined) delete process.env.TERRANAV_TRAFFIC_UPDATE_TOKEN;
    else process.env.TERRANAV_TRAFFIC_UPDATE_TOKEN = savedToken;
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
