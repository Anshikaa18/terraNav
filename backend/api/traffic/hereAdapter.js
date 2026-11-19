/**
 * HERE Traffic API v7 adapter.
 *
 * Implements strict traffic status classification:
 * - 'live': freshly fetched from provider with valid observations (> 0).
 * - 'cached': cache hit within TTL of valid observations (preserves original data, reports cacheAgeMs & cachedAt).
 * - 'stale': expired cache served as graceful fallback when provider request fails.
 * - 'unavailable': missing credentials, missing geometry, or provider returned zero observations.
 * - 'error': provider timeout, 4xx/5xx HTTP error, or network failure (when no cache exists).
 *
 * Implements robust directional map-matching:
 * - Calculates bearing of route segment vs observation geometry.
 * - Measures perpendicular distance from segment midpoint to observation polyline segments.
 * - Distinguishes opposite carriageways (heading difference > 75 deg rejected).
 * - Distinguishes perpendicular cross-streets.
 * - Handles ambiguity and reports matching confidence.
 */
const axios = require('axios');
const logger = require('../_lib/logging');

const FLOW_URL = process.env.HERE_TRAFFIC_FLOW_URL || 'https://data.traffic.hereapi.com/v7/flow';
const CACHE_TTL_MS = Math.max(15_000, Number(process.env.TRAFFIC_CACHE_TTL_MS || 60_000));
const MATCH_TOLERANCE_METERS = Math.max(20, Number(process.env.TRAFFIC_MATCH_TOLERANCE_METERS || 75));
const MAX_HEADING_DELTA_DEG = Math.max(30, Number(process.env.TRAFFIC_MAX_HEADING_DELTA_DEG || 75));

// Internal cache storage
let cache = new Map();

function clearCache() {
  cache.clear();
}

function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
    ttlMs: CACHE_TTL_MS
  };
}

function haversineMeters(a, b) {
  const r = 6371000;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
}

function midpoint(coords) {
  if (!coords || coords.length === 0) return [0, 0];
  const first = coords[0];
  const last = coords[coords.length - 1];
  return [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2];
}

/**
 * Calculate initial bearing between two [lat, lng] coordinates in degrees [0, 360).
 */
function calculateBearing(p1, p2) {
  const toRad = val => val * Math.PI / 180;
  const toDeg = val => val * 180 / Math.PI;

  const lat1 = toRad(p1[0]);
  const lon1 = toRad(p1[1]);
  const lat2 = toRad(p2[0]);
  const lon2 = toRad(p2[1]);

  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Calculate absolute difference between two bearings in degrees [0, 180].
 */
function headingDifference(brng1, brng2) {
  let diff = Math.abs(brng1 - brng2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Calculate perpendicular distance from point to line segment [a, b] in meters.
 */
function pointToSegmentDistanceMeters(point, a, b) {
  const latRef = point[0] * Math.PI / 180;
  const mLat = 111132.954;
  const mLng = 111132.954 * Math.cos(latRef);

  const px = (point[1] - a[1]) * mLng;
  const py = (point[0] - a[0]) * mLat;
  const dx = (b[1] - a[1]) * mLng;
  const dy = (b[0] - a[0]) * mLat;

  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) {
    return Math.hypot(px, py);
  }

  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
  return Math.hypot(px - t * dx, py - t * dy);
}

/**
 * Calculate minimum perpendicular distance from a point to an entire polyline.
 */
function pointToPolylineDistanceMeters(point, polyline) {
  if (!polyline || polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMeters(point, polyline[0]);

  let minDistance = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const dist = pointToSegmentDistanceMeters(point, polyline[i], polyline[i + 1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * Extract polyline points from HERE response shape/links
 */
function providerPoints(item) {
  const shape = item?.location?.shape;
  const links = Array.isArray(shape?.links) ? shape.links : [];
  const points = links.flatMap(link => link.points || link.shape || []);
  const raw = points.length ? points : (Array.isArray(shape) ? shape : []);
  return raw.map(point => {
    if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
    return [Number(point.lat ?? point.latitude), Number(point.lng ?? point.lon ?? point.longitude)];
  }).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function normalizeFlowItem(item, sourceUpdated) {
  const flow = item?.currentFlow || {};
  const speed = Number(flow.speed);
  const freeFlow = Number(flow.freeFlow);
  const jamFactor = Number(flow.jamFactor);
  const geom = providerPoints(item);

  return {
    providerSegmentReference: item?.location?.id || item?.location?.description || null,
    geometry: geom,
    observedSpeedKmh: Number.isFinite(speed) && speed >= 0 ? Math.round(speed * 3.6 * 10) / 10 : null,
    freeFlowSpeedKmh: Number.isFinite(freeFlow) && freeFlow > 0 ? Math.round(freeFlow * 3.6 * 10) / 10 : null,
    jamFactor: Number.isFinite(jamFactor) ? jamFactor : null,
    confidence: Number.isFinite(Number(flow.confidence)) ? Number(flow.confidence) : null,
    observedAt: sourceUpdated || null,
    fetchedAt: new Date().toISOString(),
    source: 'HERE Traffic API v7'
  };
}

function corridorBounds(routes) {
  if (!routes || !Array.isArray(routes) || routes.length === 0) return null;
  const points = routes.flatMap(route => route.geometry?.coordinates || []);
  if (!points.length) return null;
  const lats = points.map(point => Number(point[1]));
  const lngs = points.map(point => Number(point[0]));
  const margin = 0.005; // ~550 m corridor bounding margin
  return {
    west: Math.min(...lngs) - margin,
    south: Math.min(...lats) - margin,
    east: Math.max(...lngs) + margin,
    north: Math.max(...lats) + margin
  };
}

/**
 * Fetch traffic flow observations with explicit status and freshness handling.
 */
async function getFlowForRoutes(routes) {
  const apiKey = process.env.HERE_TRAFFIC_API_KEY;
  if (!apiKey) {
    return {
      status: 'unavailable',
      reason: 'HERE_TRAFFIC_API_KEY is not configured',
      observations: [],
      cached: false,
      observationCount: 0
    };
  }

  const bounds = corridorBounds(routes);
  if (!bounds) {
    return {
      status: 'unavailable',
      reason: 'Route geometry is unavailable',
      observations: [],
      cached: false,
      observationCount: 0
    };
  }

  const key = [bounds.west, bounds.south, bounds.east, bounds.north].map(value => value.toFixed(2)).join(':');
  const cached = cache.get(key);

  // Cache hit within TTL
  if (cached) {
    const ageMs = Date.now() - cached.createdAt;
    if (ageMs < CACHE_TTL_MS) {
      if (cached.value.status === 'live' && cached.value.observations?.length > 0) {
        return {
          ...cached.value,
          status: 'cached',
          cached: true,
          cachedAt: new Date(cached.createdAt).toISOString(),
          cacheAgeMs: ageMs,
          freshness: 'cached'
        };
      }
      return {
        ...cached.value,
        cached: true,
        cachedAt: new Date(cached.createdAt).toISOString(),
        cacheAgeMs: ageMs,
        freshness: cached.value.status
      };
    }
  }

  try {
    const response = await axios.get(FLOW_URL, {
      params: {
        in: `bbox:${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
        locationReferencing: 'shape',
        apiKey
      },
      timeout: Number(process.env.TRAFFIC_PROVIDER_TIMEOUT_MS || 4500)
    });

    const rawResults = response.data?.results || [];
    const observations = rawResults
      .map(item => normalizeFlowItem(item, response.data?.sourceUpdated))
      .filter(obs => obs.geometry?.length > 0);

    if (observations.length > 0) {
      const value = {
        status: 'live',
        observations,
        sourceUpdated: response.data?.sourceUpdated || new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
        cached: false,
        freshness: 'live',
        observationCount: observations.length
      };
      cache.set(key, { createdAt: Date.now(), value });
      return value;
    }

    // Provider succeeded but returned 0 usable observations. NEVER mark as live.
    const emptyValue = {
      status: 'unavailable',
      reason: 'No traffic observations available for route corridor',
      observations: [],
      sourceUpdated: response.data?.sourceUpdated || null,
      fetchedAt: new Date().toISOString(),
      cached: false,
      freshness: 'empty',
      observationCount: 0
    };
    cache.set(key, { createdAt: Date.now(), value: emptyValue });
    return emptyValue;

  } catch (error) {
    logger.warn(`HERE Traffic flow request failed: ${error.response?.status || error.code || error.message}`);

    // If we have an expired cache entry, serve stale fallback with honest status
    if (cached && cached.value.observations?.length > 0) {
      const ageMs = Date.now() - cached.createdAt;
      return {
        ...cached.value,
        status: 'stale',
        cached: true,
        stale: true,
        cachedAt: new Date(cached.createdAt).toISOString(),
        cacheAgeMs: ageMs,
        freshness: 'stale',
        reason: 'Live traffic request failed; serving stale cache fallback'
      };
    }

    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    const isAuthError = error.response?.status === 401 || error.response?.status === 403;
    const isRateLimit = error.response?.status === 429;

    return {
      status: 'error',
      reason: isAuthError
        ? 'HERE API key is invalid or unauthorized'
        : (isRateLimit
            ? 'HERE API rate limit exceeded'
            : (isTimeout ? 'Traffic provider timed out' : 'HERE Traffic API request failed')),
      errorType: isAuthError ? 'AUTH_ERROR' : (isRateLimit ? 'RATE_LIMIT' : (isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR')),
      httpStatus: error.response?.status || null,
      observations: [],
      cached: false,
      observationCount: 0
    };
  }
}

/**
 * Robust direction-aware road segment to traffic observation matcher.
 *
 * Checks:
 * 1. Midpoint-to-polyline perpendicular proximity (must be <= MATCH_TOLERANCE_METERS).
 * 2. Heading alignment (heading difference must be <= MAX_HEADING_DELTA_DEG).
 *    Opposite carriageway traffic (delta > 75 deg, often ~180 deg) is rejected.
 * 3. Ambiguity detection (if multiple candidate roads are equally close with conflicting speeds).
 *
 * @param {Object} segment - { coordinates: [[lat, lng], ...], roadName?: string }
 * @param {Array} observations - Normalized HERE traffic flow observations
 * @returns {Object|null} Matching result with confidence, distance, and heading delta, or null
 */
function matchObservationToSegment(segment, observations) {
  if (!segment?.coordinates || segment.coordinates.length < 2 || !Array.isArray(observations) || observations.length === 0) {
    return null;
  }

  const center = midpoint(segment.coordinates);
  const segStart = segment.coordinates[0];
  const segEnd = segment.coordinates[segment.coordinates.length - 1];
  const segBearing = calculateBearing(segStart, segEnd);

  const candidates = [];

  for (const observation of observations) {
    if (!observation.geometry || observation.geometry.length < 2) continue;

    // Perpendicular distance from segment midpoint to observation polyline
    const minDistance = pointToPolylineDistanceMeters(center, observation.geometry);
    if (minDistance > MATCH_TOLERANCE_METERS) continue;

    // Direction calculation of observation
    const obsStart = observation.geometry[0];
    const obsEnd = observation.geometry[observation.geometry.length - 1];
    const obsBearing = calculateBearing(obsStart, obsEnd);
    const headingDelta = headingDifference(segBearing, obsBearing);

    // Reject opposite carriageway or cross-street traffic
    if (headingDelta > MAX_HEADING_DELTA_DEG) {
      continue;
    }

    candidates.push({
      observation,
      distanceMeters: minDistance,
      headingDelta,
      score: minDistance + (headingDelta * 0.4) // composite score favoring aligned roads
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by composite score
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  // Ambiguity check: if there is a second candidate within 10 meters but with diverging speeds
  if (candidates.length > 1) {
    const second = candidates[1];
    const distDiff = Math.abs(second.distanceMeters - best.distanceMeters);
    if (distDiff < 10) {
      const speedDiff = Math.abs((best.observation.observedSpeedKmh || 0) - (second.observation.observedSpeedKmh || 0));
      if (speedDiff > 25) {
        // High ambiguity with conflicting speed readings — treat as unknown to prevent misclassification
        logger.debug(`Ambiguous traffic match on road segment: delta ${distDiff}m with speed delta ${speedDiff}km/h`);
        return null;
      }
    }
  }

  // Determine match confidence
  let confidence = 'high';
  if (best.distanceMeters > 45 || best.headingDelta > 45) {
    confidence = 'low';
  } else if (best.distanceMeters > 25 || best.headingDelta > 25) {
    confidence = 'medium';
  }

  return {
    matched: true,
    observation: best.observation,
    distanceMeters: Math.round(best.distanceMeters),
    headingDelta: Math.round(best.headingDelta),
    confidence
  };
}

module.exports = {
  getFlowForRoutes,
  matchObservationToSegment,
  haversineMeters,
  calculateBearing,
  headingDifference,
  pointToSegmentDistanceMeters,
  pointToPolylineDistanceMeters,
  midpoint,
  corridorBounds,
  normalizeFlowItem,
  clearCache,
  getCacheStats,
  MATCH_TOLERANCE_METERS,
  MAX_HEADING_DELTA_DEG,
  CACHE_TTL_MS
};
