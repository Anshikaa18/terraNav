import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTravelMode } from '../utils/travelMode.js';
import { normalizeResponse } from './directionService.js';

test('maps motorbike and pedal bicycle labels to distinct provider modes', () => {
  assert.equal(normalizeTravelMode('Bike'), 'motorcycle');
  assert.equal(normalizeTravelMode('motorcycle'), 'motorcycle');
  assert.equal(normalizeTravelMode('Bicycle'), 'bicycle');
  assert.equal(normalizeTravelMode('cycling'), 'bicycle');
});

test('preserves car and pedestrian mode mapping', () => {
  assert.equal(normalizeTravelMode('driving'), 'car');
  assert.equal(normalizeTravelMode('walking'), 'pedestrian');
});

test('unwraps the backend response envelope and preserves provider route data', () => {
  const route = { routeId: 'provider-route', durationSeconds: 900, distanceMeters: 4200,
    geometry: { coordinates: [[77.6, 12.9], [77.61, 12.91]] },
    steps: [{ instruction: 'Continue on Main Road', distanceMeters: 4200 }] };
  const result = normalizeResponse({ success: true, data: {
    routeId: route.routeId,
    selectedRouteId: route.routeId,
    summary: { totalDurationSeconds: 900, totalDistanceMeters: 4200 },
    routes: [route]
  }});

  assert.equal(result.routes[0].routeId, 'provider-route');
  assert.equal(result.routes[0].duration, 900);
  assert.equal(result.routes[0].coordinates.length, 2);
  assert.equal(result.routes[0].steps[0].instruction, 'Continue on Main Road');
});

test('uses backend route coordinates in their supplied Leaflet order and does not color predicted traffic', () => {
  const result = normalizeResponse({
    routeId: 'route-1',
    selectedRouteId: 'route-1',
    summary: { totalDurationSeconds: 300, totalDistanceMeters: 1200 },
    routes: [{
      routeId: 'route-1',
      coordinates: [[12.97, 77.60], [12.98, 77.61]],
      chunks: [{
        segmentId: 'segment-1',
        coordinates: [[12.97, 77.60], [12.98, 77.61]],
        valueType: 'predicted',
        trafficClass: 'heavy'
      }]
    }]
  });

  assert.deepEqual(result.routes[0].coordinates, [[12.97, 77.60], [12.98, 77.61]]);
  assert.equal(result.routes[0].segments[0].trafficClass, 'unknown');
});
