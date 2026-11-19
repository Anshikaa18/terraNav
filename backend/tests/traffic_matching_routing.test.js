/**
 * Automated Test Suite for Tasks 1, 2, and 4:
 * - Traffic data status, caching, freshness, and failure handling
 * - Direction-aware road-segment matching and ambiguity handling
 * - Honest dynamic route ETA and savings calculations
 */
const assert = require('assert');
const hereAdapter = require('../api/traffic/hereAdapter');
const routingAdapter = require('../api/directions/routingAdapter');
const { trafficClass, createSegmentsFromRoute } = require('../api/directions/service');

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name} ->`, err.message);
    failed++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name} ->`, err.message);
    failed++;
  }
}

async function run() {
  console.log('\n============================================================');
  console.log('  Testing Traffic Status, Map Matching, & Honest Routing');
  console.log('============================================================\n');

  // --------------------------------------------------------------------------
  // TASK 1: Traffic Status & Caching Tests
  // --------------------------------------------------------------------------
  console.log('[Task 1: Traffic Status, Caching & Failure Modes]');

  await itAsync('Missing API credentials returns unavailable (not live)', async () => {
    const savedKey = process.env.HERE_TRAFFIC_API_KEY;
    delete process.env.HERE_TRAFFIC_API_KEY;
    const res = await hereAdapter.getFlowForRoutes([
      { geometry: { coordinates: [[77.60, 12.97], [77.61, 12.98]] } }
    ]);
    process.env.HERE_TRAFFIC_API_KEY = savedKey;
    assert.strictEqual(res.status, 'unavailable');
    assert.ok(res.reason.includes('HERE_TRAFFIC_API_KEY'));
    assert.strictEqual(res.observations.length, 0);
  });

  await itAsync('Missing route geometry returns unavailable', async () => {
    const res = await hereAdapter.getFlowForRoutes([]);
    assert.strictEqual(res.status, 'unavailable');
    assert.ok(res.reason.includes('geometry'));
  });

  it('Empty flow item has null observed speed', () => {
    const emptyFlowItem = hereAdapter.normalizeFlowItem({ location: {}, currentFlow: {} });
    assert.strictEqual(emptyFlowItem.observedSpeedKmh, null);
    assert.strictEqual(emptyFlowItem.freeFlowSpeedKmh, null);
  });

  it('Cache stats reports size and TTL', () => {
    const stats = hereAdapter.getCacheStats();
    assert.strictEqual(typeof stats.size, 'number');
    assert.strictEqual(typeof stats.ttlMs, 'number');
  });

  // --------------------------------------------------------------------------
  // TASK 2: Direction-Aware Road-Segment Matching Tests
  // --------------------------------------------------------------------------
  console.log('\n[Task 2: Direction-Aware Road-Segment Matching]');

  it('Calculates bearings accurately', () => {
    const brngNorth = hereAdapter.calculateBearing([0, 0], [1, 0]);
    assert.ok(Math.abs(brngNorth - 0) < 1, `North bearing got ${brngNorth}`);
    const brngEast = hereAdapter.calculateBearing([0, 0], [0, 1]);
    assert.ok(Math.abs(brngEast - 90) < 1, `East bearing got ${brngEast}`);
    const brngSouth = hereAdapter.calculateBearing([1, 0], [0, 0]);
    assert.ok(Math.abs(brngSouth - 180) < 1, `South bearing got ${brngSouth}`);
  });

  it('Calculates heading differences across 0/360 wrap-around', () => {
    assert.strictEqual(hereAdapter.headingDifference(10, 20), 10);
    assert.strictEqual(hereAdapter.headingDifference(350, 10), 20);
    assert.strictEqual(hereAdapter.headingDifference(0, 180), 180);
  });

  it('Calculates perpendicular distance to road segment accurately', () => {
    // Road from (12.97008, 77.6000) to (12.97008, 77.6050)
    // Point at (12.97000, 77.6025) is ~8.9m south of the road
    const dist = hereAdapter.pointToSegmentDistanceMeters(
      [12.9700, 77.6025],
      [12.97008, 77.6000],
      [12.97008, 77.6050]
    );
    assert.ok(dist > 8 && dist < 10, `Expected ~8.9m, got ${dist}`);
  });

  const eastSegment = {
    segmentId: 'seg_east_1',
    coordinates: [[12.9700, 77.6000], [12.9700, 77.6050]]
  };

  const obsEast = {
    providerSegmentReference: 'here_link_east',
    geometry: [[12.97008, 77.6000], [12.97008, 77.6050]],
    observedSpeedKmh: 45,
    freeFlowSpeedKmh: 50
  };

  const obsWestOpposing = {
    providerSegmentReference: 'here_link_west_opposing',
    geometry: [[12.97012, 77.6050], [12.97012, 77.6000]],
    observedSpeedKmh: 10, // gridlocked opposing traffic
    freeFlowSpeedKmh: 50
  };

  const obsPerpendicular = {
    providerSegmentReference: 'here_cross_street',
    geometry: [[12.9680, 77.6025], [12.9720, 77.6025]],
    observedSpeedKmh: 20,
    freeFlowSpeedKmh: 40
  };

  it('Matches same-direction Eastbound carriageway successfully', () => {
    const match = hereAdapter.matchObservationToSegment(eastSegment, [obsEast]);
    assert.ok(match && match.matched);
    assert.strictEqual(match.observation.providerSegmentReference, 'here_link_east');
    assert.ok(match.distanceMeters < 15, `Distance was ${match.distanceMeters}`);
    assert.ok(match.headingDelta < 5, `Heading delta was ${match.headingDelta}`);
    assert.strictEqual(match.confidence, 'high');
  });

  it('Rejects opposite-direction Westbound traffic (delta ~180 deg)', () => {
    const match = hereAdapter.matchObservationToSegment(eastSegment, [obsWestOpposing]);
    assert.strictEqual(match, null, 'Opposite traffic must not match');
  });

  it('Rejects perpendicular cross-street traffic (delta ~90 deg)', () => {
    const match = hereAdapter.matchObservationToSegment(eastSegment, [obsPerpendicular]);
    assert.strictEqual(match, null, 'Cross-street traffic must not match');
  });

  it('Disambiguates and chooses correct carriageway when both are present', () => {
    const match = hereAdapter.matchObservationToSegment(eastSegment, [obsWestOpposing, obsEast]);
    assert.ok(match && match.matched);
    assert.strictEqual(match.observation.providerSegmentReference, 'here_link_east');
    assert.strictEqual(match.observation.observedSpeedKmh, 45, 'Retains free-flow eastbound speed, not opposing gridlock');
  });

  it('Rejects out-of-range observations (> 75m tolerance)', () => {
    const obsFar = {
      providerSegmentReference: 'here_far_road',
      geometry: [[12.9800, 77.6000], [12.9800, 77.6050]],
      observedSpeedKmh: 30
    };
    const match = hereAdapter.matchObservationToSegment(eastSegment, [obsFar]);
    assert.strictEqual(match, null);
  });

  // --------------------------------------------------------------------------
  // TASK 4: Honest Route ETA and Savings Calculations
  // --------------------------------------------------------------------------
  console.log('\n[Task 4: Honest Route Cost, ETA & Savings]');

  it('Computes physically grounded travel time: 1000m @ 60 km/h = 60s', () => {
    const cost = routingAdapter.calculateChunkCost(
      { lengthMeters: 1000, providerDurationSeconds: 60, valueType: 'observed', observedSpeedKmh: 60, freeFlowSpeedKmh: 60, hasSignal: false, trafficClass: 'free_flowing', costSource: 'observed-speed' },
      'car'
    );
    assert.strictEqual(cost.durationSeconds, 60);
  });

  it('Prevents double-counting queue delay when speed is already observed slowdown', () => {
    const cost = routingAdapter.calculateChunkCost(
      { lengthMeters: 1000, providerDurationSeconds: 60, valueType: 'observed', observedSpeedKmh: 15, freeFlowSpeedKmh: 60, hasSignal: false, trafficClass: 'severe', costSource: 'observed-speed' },
      'car'
    );
    assert.strictEqual(cost.queueDelaySeconds, 0);
    assert.strictEqual(cost.durationSeconds, 240); // (1000 / 15) * 3.6 = 240s
  });

  it('Reports honest negative savings (traffic delay) without artificial +60s inflation', () => {
    const congestedChunks = [
      { segmentId: 'c1', lengthMeters: 1000, providerDurationSeconds: 60, observedSpeedKmh: 15, freeFlowSpeedKmh: 60, valueType: 'observed', trafficClass: 'severe', costSource: 'observed-speed' },
      { segmentId: 'c2', lengthMeters: 1000, providerDurationSeconds: 60, observedSpeedKmh: 15, freeFlowSpeedKmh: 60, valueType: 'observed', trafficClass: 'severe', costSource: 'observed-speed' }
    ];
    // Independent baseline: 2000m @ 60 km/h = 120s
    const result = routingAdapter.solveDynamicRoute({
      chunks: congestedChunks,
      mode: 'car',
      baselineDurationSeconds: 120
    });
    assert.strictEqual(result.summary.totalDurationSeconds, 480);
    assert.strictEqual(result.summary.traditionalDurationSeconds, 120);
    assert.strictEqual(result.summary.timeSavedSeconds, -360, 'Negative savings reports delay');
    assert.strictEqual(result.summary.baselineMethod, 'routing-provider-duration');
  });

  it('Reports honest positive savings when dynamic route is faster than baseline', () => {
    const clearChunks = [
      { segmentId: 'c3', lengthMeters: 1000, providerDurationSeconds: 60, observedSpeedKmh: 60, freeFlowSpeedKmh: 60, valueType: 'observed', trafficClass: 'free_flowing', costSource: 'observed-speed' },
      { segmentId: 'c4', lengthMeters: 1000, providerDurationSeconds: 60, observedSpeedKmh: 60, freeFlowSpeedKmh: 60, valueType: 'observed', trafficClass: 'free_flowing', costSource: 'observed-speed' }
    ];
    const result = routingAdapter.solveDynamicRoute({
      chunks: clearChunks,
      mode: 'car',
      baselineDurationSeconds: 150
    });
    assert.strictEqual(result.summary.totalDurationSeconds, 120);
    assert.strictEqual(result.summary.timeSavedSeconds, 30);
  });

  it('Applies severe detour penalty for roadblock incidents', () => {
    const roadblockChunks = [
      { segmentId: 'rb1', lengthMeters: 500, providerDurationSeconds: 100, freeFlowSpeedKmh: 50, trafficClass: 'free_flowing' }
    ];
    const result = routingAdapter.solveDynamicRoute({
      chunks: roadblockChunks,
      mode: 'car',
      baselineDurationSeconds: 100,
      incident: { chunkId: 'rb1', type: 'roadblock' }
    });
    assert.ok(result.summary.totalDurationSeconds >= 1800);
  });

  it('Motorcycle profile filters through bottlenecks faster than car', () => {
    const carCost = routingAdapter.calculateChunkCost(
      { segmentId: 'i1', lengthMeters: 500, providerDurationSeconds: 30 },
      'car',
      { chunkId: 'i1', type: 'accident' }
    );
    const motoCost = routingAdapter.calculateChunkCost(
      { segmentId: 'i1', lengthMeters: 500, providerDurationSeconds: 30 },
      'motorcycle',
      { chunkId: 'i1', type: 'accident' }
    );
    assert.ok(motoCost.incidentPenalty < carCost.incidentPenalty);
  });

  it('Uses Valhalla route duration for bicycle and applies observed speed ratios to motor modes only', () => {
    const segment = { lengthMeters: 1000, providerDurationSeconds: 90, observedSpeedKmh: 20, freeFlowSpeedKmh: 60, valueType: 'observed' };
    assert.strictEqual(routingAdapter.calculateChunkCost(segment, 'bicycle').durationSeconds, 90);
    assert.strictEqual(routingAdapter.calculateChunkCost(segment, 'car').durationSeconds, 270);
  });

  it('Segments provider geometry by navigation maneuvers and preserves connected coordinate order', () => {
    const segments = createSegmentsFromRoute({
      distanceMeters: 300,
      durationSeconds: 30,
      geometry: { coordinates: [[77.6000, 12.9700], [77.6010, 12.9700], [77.6020, 12.9700]] },
      legs: [{ steps: [
        { name: 'First Road', distance: 100, duration: 10, maneuver: { type: 'depart' }, geometry: { coordinates: [[77.6000, 12.9700], [77.6010, 12.9700]] } },
        { name: 'Second Road', distance: 200, duration: 20, maneuver: { type: 'turn' }, geometry: { coordinates: [[77.6010, 12.9700], [77.6020, 12.9700]] } }
      ] }]
    });
    assert.strictEqual(segments.length, 2);
    assert.strictEqual(segments[0].roadName, 'First Road');
    assert.deepStrictEqual(segments[0].coordinates.at(-1), segments[1].coordinates[0]);
    assert.deepStrictEqual(segments[0].coordinates[0], [12.9700, 77.6000]);
    assert.strictEqual(segments[0].providerDurationSeconds + segments[1].providerDurationSeconds, 30);
  });

  console.log('\n============================================================');
  console.log(`  Tests Completed: ${passed + failed}`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
