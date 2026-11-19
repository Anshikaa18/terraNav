import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatDuration } from './geo.js';

test('formats the requested minute and hour boundaries', () => {
  assert.equal(formatDuration(45 * 60), '45 min');
  assert.equal(formatDuration(60 * 60), '1 hr');
  assert.equal(formatDuration(80 * 60), '1 hr 20 min');
  assert.equal(formatDuration(120 * 60), '2 hr');
});

test('handles zero and invalid or missing durations without inventing an ETA', () => {
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(undefined), '');
  assert.equal(formatDuration(null), '');
  assert.equal(formatDuration('not a duration'), '');
  assert.equal(formatDuration(-1), '');
});

test('formats distances in either configured unit', () => {
  assert.equal(formatDistance(1.25, 'km'), '1.3 km');
  assert.equal(formatDistance(1.25, 'm'), '1250 m');
  assert.equal(formatDistance(-1, 'km'), '');
});
