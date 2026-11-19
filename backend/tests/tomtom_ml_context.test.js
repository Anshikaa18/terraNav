const assert = require('assert');
const { buildModelInput } = require('../api/directions/mlAdapter');

const baseChunk = { sequence: 1, lengthMeters: 420, hasSignal: false, incident: null };
const observed = { source: 'TomTom Traffic Flow API', observedSpeedKmh: 15, freeFlowSpeedKmh: 60, roadClosure: false };
const featureRow = buildModelInput(baseChunk, observed);

assert.strictEqual(featureRow['Road Capacity Utilization'], null, 'observed speed must not become a speed-model feature');
assert.strictEqual(featureRow['Estimated Chunk Traffic Volume (synthetic)'], null, 'observed speed must not fabricate traffic-volume feature');
assert.strictEqual(featureRow['Estimated Queue Length (m; synthetic)'], null, 'observed speed must not fabricate queue-length feature');
assert.strictEqual(featureRow['Estimated Incident Delay (sec; synthetic)'], 0, 'open TomTom road has no closure delay feature');

const closureRow = buildModelInput(baseChunk, { ...observed, roadClosure: true });
assert.strictEqual(closureRow['Estimated Incident Delay (sec; synthetic)'], 900, 'TomTom road closure becomes a non-target ML incident-delay feature');

console.log('  ✓ PASS: TomTom speed is kept out of ML target features');
console.log('  ✓ PASS: TomTom road-closure context is used for ML incident delay');
