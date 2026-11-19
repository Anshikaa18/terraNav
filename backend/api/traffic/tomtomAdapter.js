/**
 * TomTom Traffic Flow/Incidents adapter. Keys are read only from server process
 * environment; clients receive normalized observations, never provider credentials.
 */
const axios = require('axios');
const logger = require('../_lib/logging');
const hereGeometry = require('./hereAdapter');

const FLOW_URL = process.env.TOMTOM_FLOW_URL || 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const INCIDENTS_URL = process.env.TOMTOM_INCIDENTS_URL || 'https://api.tomtom.com/traffic/services/5/incidentDetails';
const TIMEOUT_MS = Number(process.env.TRAFFIC_PROVIDER_TIMEOUT_MS || 4500);
const MAX_FRESH_AGE_MS = Math.max(15_000, Number(process.env.TOMTOM_MAX_FRESH_AGE_MS || 300_000));
const cache = new Map();

function routeSamplePoints(routes) {
  const seen = new Set();
  const points = [];
  for (const route of routes || []) {
    const coordinates = route?.geometry?.coordinates || [];
    for (let i = 0; i < coordinates.length; i += Math.max(1, Math.floor(coordinates.length / 12))) {
      const [lng, lat] = coordinates[i] || [];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      if (!seen.has(key)) { seen.add(key); points.push({ lat, lng }); }
      if (points.length >= 12) return points;
    }
  }
  return points;
}

function flowGeometry(data, point) {
  const coordinates = data?.flowSegmentData?.coordinates?.coordinate;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    return coordinates.map(p => [Number(p.latitude), Number(p.longitude)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }
  // A point-only response cannot safely be direction-matched, so it is not used.
  return point ? [[point.lat, point.lng]] : [];
}

function normalizeFlow(data, point) {
  const flow = data?.flowSegmentData || {};
  const currentSpeed = Number(flow.currentSpeed);
  const freeFlowSpeed = Number(flow.freeFlowSpeed);
  const confidence = Number(flow.confidence);
  const geometry = flowGeometry(data, point);
  return {
    providerSegmentReference: flow.roadId || flow.frc || `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
    geometry,
    observedSpeedKmh: Number.isFinite(currentSpeed) && currentSpeed >= 0 ? currentSpeed : null,
    freeFlowSpeedKmh: Number.isFinite(freeFlowSpeed) && freeFlowSpeed > 0 ? freeFlowSpeed : null,
    currentTravelTimeSeconds: Number.isFinite(Number(flow.currentTravelTime)) ? Number(flow.currentTravelTime) : null,
    freeFlowTravelTimeSeconds: Number.isFinite(Number(flow.freeFlowTravelTime)) ? Number(flow.freeFlowTravelTime) : null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    roadClosure: flow.roadClosure === true,
    observedAt: null, // TomTom flow response does not guarantee per-segment observation time.
    fetchedAt: new Date().toISOString(),
    source: 'TomTom Traffic Flow API'
  };
}

async function getIncidentsForBounds(bounds, apiKey) {
  if (!bounds) return { incidents: [], incidentStatus: 'unavailable' };
  try {
    const response = await axios.get(INCIDENTS_URL, { params: {
      key: apiKey,
      bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
      fields: '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,startTime,endTime,lastReportTime,roadNumbers}}}',
      language: 'en-US', timeValidityFilter: 'present'
    }, timeout: TIMEOUT_MS });
    return { incidents: response.data?.incidents || [], incidentStatus: 'live' };
  } catch (error) {
    return { incidents: [], incidentStatus: 'error', incidentReason: error.response?.status || error.code || error.message };
  }
}

async function getFlowForRoutes(routes) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return { status: 'unavailable', reason: 'TOMTOM_API_KEY is not configured', observations: [], incidents: [], observationCount: 0 };
  const points = routeSamplePoints(routes);
  if (!points.length) return { status: 'unavailable', reason: 'Route geometry is unavailable', observations: [], incidents: [], observationCount: 0 };
  const cacheKey = points.map(point => `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`).join(':');
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < MAX_FRESH_AGE_MS) {
    return { ...cached.value, status: 'cached', cached: true, cacheAgeMs: Date.now() - cached.createdAt, freshness: 'cached' };
  }
  try {
    const results = await Promise.all(points.map(async point => {
      const response = await axios.get(FLOW_URL, { params: { key: apiKey, point: `${point.lat},${point.lng}`, unit: 'KMPH' }, timeout: TIMEOUT_MS });
      return normalizeFlow(response.data, point);
    }));
    // Only observations with speed, free-flow speed, and line geometry can affect ETA.
    const observations = results.filter(o => o.observedSpeedKmh !== null && o.freeFlowSpeedKmh !== null && o.geometry.length >= 2);
    const bounds = hereGeometry.corridorBounds(routes);
    const incidentData = await getIncidentsForBounds(bounds, apiKey);
    if (!observations.length) return {
      status: 'unavailable', reason: 'TomTom returned no usable, direction-matchable traffic observations',
      observations: [], observationCount: 0, fetchedAt: new Date().toISOString(), freshness: 'empty', ...incidentData
    };
    const value = {
      status: 'live', observations, observationCount: observations.length,
      sourceUpdated: null, fetchedAt: new Date().toISOString(), freshness: 'live', ...incidentData
    };
    cache.set(cacheKey, { createdAt: Date.now(), value });
    return value;
  } catch (error) {
    const httpStatus = error.response?.status || null;
    const type = httpStatus === 401 || httpStatus === 403 ? 'AUTH_ERROR' : httpStatus === 429 ? 'RATE_LIMIT' : error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'PROVIDER_ERROR';
    logger.warn(`TomTom Traffic request failed: ${httpStatus || error.code || error.message}`);
    if (cached?.value?.observations?.length) {
      return {
        ...cached.value, status: 'stale', cached: true, stale: true,
        cacheAgeMs: Date.now() - cached.createdAt, freshness: 'stale',
        reason: 'TomTom Traffic API request failed; stale cache not used for ETA'
      };
    }
    return { status: 'error', reason: type === 'AUTH_ERROR' ? 'TomTom API key is invalid or unauthorized' : type === 'RATE_LIMIT' ? 'TomTom API rate limit exceeded' : type === 'TIMEOUT' ? 'TomTom Traffic API timed out' : 'TomTom Traffic API request failed', errorType: type, httpStatus, observations: [], incidents: [], observationCount: 0 };
  }
}

function clearCache() { cache.clear(); }
module.exports = { getFlowForRoutes, getIncidentsForBounds, normalizeFlow, routeSamplePoints, matchObservationToSegment: hereGeometry.matchObservationToSegment, MAX_FRESH_AGE_MS, clearCache };
