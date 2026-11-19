/** Dynamic directions: provider route ETAs -> live traffic speed adjustments where supported. */
const { getOsrmRoutes } = require('../_lib/navigation');
const mlAdapter = require('./mlAdapter');
const routingAdapter = require('./routingAdapter');
const trafficAdapter = require('../traffic/adapter');
const incidentService = require('../incidents/service');
const historyService = require('../history/service');
const logger = require('../_lib/logging');
const { ServiceUnavailableError, BadRequestError } = require('../_lib/errors');

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const r = 6371e3;
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function segmentId(points) {
  const first = points[0];
  const last = points[points.length - 1];
  const value = `${first[0].toFixed(5)},${first[1].toFixed(5)}:${last[0].toFixed(5)},${last[1].toFixed(5)}`;
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) hash = ((hash * 33) ^ value.charCodeAt(i)) >>> 0;
  return `seg_${hash.toString(36)}`;
}

function routePoints(geometry) {
  const raw = geometry?.coordinates;
  if (!Array.isArray(raw) || raw.length < 2) return [];
  return raw.map(([lng, lat]) => [Number(lat), Number(lng)])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function stepPoints(step) {
  return routePoints(step?.geometry);
}

function validDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration >= 0 ? duration : null;
}

function validDistance(value) {
  const distance = Number(value);
  return Number.isFinite(distance) && distance > 0 ? distance : null;
}

/**
 * Preserve router geometry and split on provider navigation maneuvers.  The old
 * implementation cut every route into arbitrary 350 m chunks, then assigned
 * step names by array index.  That could color the wrong road and did not
 * represent the provider's actual road sections.
 */
function createSegmentsFromRoute(route) {
  const points = routePoints(route.geometry);
  if (points.length < 2) throw new Error('Router returned no usable road geometry');
  const steps = (route.legs || []).flatMap(leg => Array.isArray(leg.steps) ? leg.steps : []);
  const segments = steps.map((step, index) => {
    const coordinates = stepPoints(step);
    if (coordinates.length < 2) return null;
    const derivedLength = coordinates.slice(1).reduce(
      (total, point, pointIndex) => total + calculateDistanceMeters(coordinates[pointIndex][0], coordinates[pointIndex][1], point[0], point[1]),
      0
    );
    const sequence = index + 1;
    const id = segmentId(coordinates);
    return {
      segmentId: id,
      chunkId: id, // compatibility alias, not a provider ID
      legacyChunkId: `CHUNK_${100 + sequence}`,
      sequence,
      segmentKind: 'maneuver',
      roadName: step.name || 'Unnamed road',
      roadType: step.ref || null,
      maneuver: step.maneuver || null,
      lengthMeters: Math.round(validDistance(step.distance) || derivedLength),
      providerDurationSeconds: validDuration(step.duration),
      freeFlowSpeedKmh: null,
      hasSignal: false,
      providerTrafficIncluded: route.provider === 'TOMTOM',
      coordinates
    };
  }).filter(Boolean);

  // A router may omit per-step geometry. Keep its actual geometry as a single
  // provider leg instead of fabricating fixed-length road chunks.
  if (!segments.length) {
    const id = segmentId(points);
    segments.push({
      segmentId: id,
      chunkId: id,
      legacyChunkId: 'CHUNK_101',
      sequence: 1,
      segmentKind: 'provider-leg',
      roadName: 'Provider route leg',
      roadType: null,
      lengthMeters: Math.round(validDistance(route.distanceMeters) || points.slice(1).reduce(
        (total, point, index) => total + calculateDistanceMeters(points[index][0], points[index][1], point[0], point[1]), 0
      )),
      providerDurationSeconds: validDuration(route.durationSeconds),
      freeFlowSpeedKmh: null,
      hasSignal: false,
      providerTrafficIncluded: route.provider === 'TOMTOM',
      coordinates: points
    });
  }

  const providerDurationSeconds = Number(route.durationSeconds);
  if (!Number.isFinite(providerDurationSeconds) || providerDurationSeconds < 0 || segments.length === 0) {
    throw new Error('Routing provider returned a route without a valid duration.');
  }
  const totalSegmentMeters = segments.reduce((sum, segment) => sum + segment.lengthMeters, 0);
  let allocatedSeconds = 0;
  segments.forEach((segment, index) => {
    if (segment.providerDurationSeconds !== null) {
      allocatedSeconds += segment.providerDurationSeconds;
      return;
    }
    const remainingDuration = Math.max(0, providerDurationSeconds - allocatedSeconds);
    const remainingDistance = segments.slice(index).reduce((sum, current) => sum + current.lengthMeters, 0);
    const durationSeconds = index === segments.length - 1 || remainingDistance <= 0
      ? remainingDuration
      : remainingDuration * (segment.lengthMeters / remainingDistance);
    segment.providerDurationSeconds = durationSeconds;
    allocatedSeconds += durationSeconds;
  });
  return segments;
}

function trafficClass(speed, freeFlow, isStale = false) {
  if (isStale || !Number.isFinite(speed) || !Number.isFinite(freeFlow) || freeFlow <= 0) return 'unknown';
  const ratio = Math.max(0, Math.min(1, speed / freeFlow));
  if (ratio >= 0.8) return 'free_flowing';
  if (ratio >= 0.6) return 'moderate';
  if (ratio >= 0.4) return 'heavy';
  return 'severe';
}

function addObservation(segment, match, providerStatus) {
  if (!match || !match.matched || !match.observation) {
    return {
      ...segment,
      observation: null,
      trafficClass: 'unknown',
      valueType: 'unavailable',
      trafficStatus: providerStatus,
      matchReason: match?.reason || 'no_match'
    };
  }
  const observation = match.observation;
  return {
    ...segment,
    observation,
    providerSegmentReference: observation.providerSegmentReference,
    observedSpeedKmh: observation.observedSpeedKmh,
    freeFlowSpeedKmh: observation.freeFlowSpeedKmh,
    jamFactor: observation.jamFactor,
    roadClosure: observation.roadClosure === true,
    observedAt: observation.observedAt,
    source: observation.source,
    confidence: observation.confidence,
    matchDistanceMeters: Math.round(match.distanceMeters),
    matchHeadingDelta: match.headingDelta !== undefined ? Math.round(match.headingDelta) : null,
    matchConfidence: match.confidence || 'medium',
    trafficClass: trafficClass(observation.observedSpeedKmh, observation.freeFlowSpeedKmh),
    valueType: 'observed',
    trafficStatus: providerStatus
  };
}

async function enrichCandidate(route, traffic) {
  const hasFreshTraffic = traffic.status === 'live' || traffic.status === 'cached';
  const observations = hasFreshTraffic ? traffic.observations : [];
  let segments = createSegmentsFromRoute(route).map(segment =>
    addObservation(segment, trafficAdapter.matchObservationToSegment(segment, observations), traffic.status)
  );
  for (const segment of segments) {
    // Incident enrichment is additive. A database outage must not suppress route
    // and traffic-provider results that remain independently available.
    try {
      const incident = await incidentService.getActiveIncidentForChunk(segment.segmentId);
      segment.incident = incident || null;
    } catch (error) {
      logger.warn(`Incident lookup unavailable for ${segment.segmentId}: ${error.message}`);
      segment.incident = null;
      segment.incidentStatus = 'unavailable';
    }
  }
  return segments.map(segment => {
    const hasObserved = Number.isFinite(segment.observedSpeedKmh);
    const valueType = hasObserved ? 'observed' : 'unavailable';
    return {
      ...segment,
      effectiveSpeedKmh: hasObserved ? segment.observedSpeedKmh : null,
      predictedSpeedKmh: null,
      predictionStatus: 'unavailable',
      predictionError: 'No validated live features are available for the research model.',
      valueType,
      trafficClass: hasObserved ? segment.trafficClass : 'unknown',
      costSource: hasObserved && !segment.providerTrafficIncluded ? 'observed-speed' : 'routing-provider-duration'
    };
  });
}

async function getDynamicDirections({
  origin,
  destination,
  originName,
  destinationName,
  mode = 'car',
  simulatedIncident = null,
  userId = null,
  strategy = 'provider'
}) {
  logger.info(`Processing traffic-aware directions: mode=${mode}, strategy=${strategy}, user=${userId || 'anonymous'}`);

  // The bundled graph only contains coarse corridor connectors and static costs.
  // It has neither validated live model inputs nor road-following edge geometry,
  // so it must not be exposed as a production route.
  if (['ml_astar', 'graph', 'ml_dynamic', 'dynamic_ml'].includes(strategy)) {
    throw new ServiceUnavailableError(
      'ML-optimized routing is unavailable for live trips because its model inputs and road geometries are not validated. Use provider routing explicitly.',
      { code: 'ML_ROUTING_NOT_OPERATIONAL', network: 'Bengaluru research corridor graph' }
    );
  }
  if (strategy !== 'provider') {
    throw new BadRequestError(`Unsupported routing strategy "${strategy}".`, { supportedStrategies: ['provider'] });
  }

  // The routing provider is authoritative for route geometry and mode-specific
  // duration. Direction-matched speed observations can supplement non-traffic
  // routers; the research model is not used without validated live features.
  const candidates = await getOsrmRoutes(origin, destination, mode);
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new ServiceUnavailableError('The configured routing provider returned no usable routes.', { code: 'NO_ROUTE_CANDIDATES' });
  }
  const traffic = await trafficAdapter.getFlowForRoutes(candidates);
  const evaluated = [];
  for (const candidate of candidates) {
    const chunks = await enrichCandidate(candidate, traffic);
    const incident = simulatedIncident && chunks.find(chunk => chunk.segmentId === simulatedIncident.chunkId || chunk.legacyChunkId === simulatedIncident.chunkId)
      ? simulatedIncident : null;
    const rawSteps = candidate.legs?.[0]?.steps || [];
    const result = routingAdapter.solveDynamicRoute({
      chunks,
      mode,
      incident,
      baselineDurationSeconds: candidate.durationSeconds,
      rawSteps
    });
    const hasPredictions = chunks.some(c => c.valueType === 'predicted');
    const routingStrategy = `${candidate.provider}-${hasPredictions ? 'ml-traffic' : 'provider-routing'}`;
    result.summary.routingStrategy = routingStrategy;
    result.summary.isMlOptimized = hasPredictions;

    evaluated.push({
      routeId: candidate.id,
      provider: candidate.provider,
      routingStrategy,
      isMlOptimized: hasPredictions,
      // The browser consumes `coordinates` as [lat, lng]. Retain the complete
      // provider geometry rather than rebuilding it from chunk endpoints.
      coordinates: candidate.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceMeters: candidate.distanceMeters,
      baselineDurationSeconds: candidate.durationSeconds,
      trafficMetrics: candidate.trafficMetrics || null,
      ...result
    });
  }

  evaluated.sort((a, b) => a.summary.totalDurationSeconds - b.summary.totalDurationSeconds);
  const selected = evaluated[0];
  const trafficMatchedSegments = selected.chunks.filter((chunk) => chunk.valueType === 'observed').length;
  const liveTrafficDurationAvailable = Number.isFinite(selected.trafficMetrics?.liveTrafficDurationSeconds);
  const trafficAdjustsEta = liveTrafficDurationAvailable || (
    ['car', 'driving', 'motorcycle', 'bike'].includes(mode) && trafficMatchedSegments > 0 && selected.provider !== 'TOMTOM'
  );
  const usesLiveTraffic = (traffic.status === 'live' || traffic.status === 'cached') && trafficAdjustsEta;
  // A provider response is only live when observations were direction-matched
  // and used in ETA. Model output and a router-only ETA must not be presented
  // as traffic estimates.
  const trafficStatus = liveTrafficDurationAvailable || usesLiveTraffic
    ? (usesLiveTraffic && traffic.status === 'cached' ? 'cached' : 'live')
    : (traffic.status === 'stale' ? 'stale' : 'unavailable');
  const response = {
    routeId: selected.routeId,
    selectedRouteId: selected.routeId,
    status: trafficStatus,
    routingStrategy: selected.routingStrategy || `${selected.provider}-traffic-aware`,
    isMlOptimized: selected.isMlOptimized !== undefined ? selected.isMlOptimized : selected.chunks.some((chunk) => chunk.valueType === 'predicted'),
    traffic: {
      status: trafficStatus,
      providerStatus: traffic.status,
      sourceUpdated: traffic.sourceUpdated || null,
      reason: traffic.reason || null,
      cached: Boolean(traffic.cached),
      cacheAgeMs: traffic.cacheAgeMs || null,
      cachedAt: traffic.cachedAt || null,
      observationCount: traffic.observationCount || 0,
      freshness: traffic.freshness || traffic.status,
      matchedSegmentCount: trafficMatchedSegments,
      adjustsEta: trafficAdjustsEta,
      routingProvider: selected.provider,
      providerEstimateIncludesTraffic: selected.provider === 'TOMTOM' && selected.trafficMetrics?.trafficRequested === true,
      routeTrafficMetrics: selected.trafficMetrics || null,
      etaMode: mode
    },
    summary: selected.summary,
    chunks: selected.chunks,
    steps: selected.steps,
    routes: evaluated
  };
  if (userId) {
    await historyService.logRouteHistory(userId, {
      origin_lat: origin.lat, origin_lng: origin.lng, origin_name: originName || `${origin.lat}, ${origin.lng}`,
      dest_lat: destination.lat, dest_lng: destination.lng, dest_name: destinationName || `${destination.lat}, ${destination.lng}`,
      transport_mode: mode, total_distance_meters: selected.summary.totalDistanceMeters,
      total_duration_seconds: selected.summary.totalDurationSeconds,
      traditional_duration_seconds: selected.summary.traditionalDurationSeconds,
      time_saved_seconds: selected.summary.timeSavedSeconds, simulated_incident: simulatedIncident
    }).catch(error => logger.warn(`Failed to log route history: ${error.message}`));
  }
  return response;
}

module.exports = {
  getDynamicDirections,
  calculateDistanceMeters,
  createSegmentsFromRoute,
  trafficClass,
  evaluateReroute: mlAdapter.evaluateReroute,
  updateGraphTraffic: mlAdapter.updateGraphTraffic,
  getNetworkInfo: mlAdapter.getNetworkInfo
};
