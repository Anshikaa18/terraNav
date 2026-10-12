/**
 * TerraNav AI — Dynamic Directions Integration Service
 * Member 3: Backend Integration & Microservices
 */

const { getOsrmRoute } = require('../_lib/navigation');
const mlAdapter = require('./mlAdapter');
const routingAdapter = require('./routingAdapter');
const incidentService = require('../incidents/service');
const historyService = require('../history/service');
const logger = require('../_lib/logging');

/**
 * Calculate Great-Circle Distance between two coordinates in meters (Haversine)
 */
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Build 200m-500m chunks from real OSRM road network geometry
 */
function createChunksFromOsrmRoute(osrmResult) {
  if (!osrmResult || !osrmResult.geometry || !Array.isArray(osrmResult.geometry.coordinates) || osrmResult.geometry.coordinates.length < 2) {
    return null;
  }

  // OSRM GeoJSON is [longitude, latitude] -> convert to Leaflet [lat, lng]
  const rawPoints = osrmResult.geometry.coordinates.map(pt => [
    parseFloat(pt[1].toFixed(6)),
    parseFloat(pt[0].toFixed(6))
  ]);

  const totalDist = osrmResult.distanceMeters || 1000;
  const targetChunkLen = 350; // target 200m - 500m
  const numChunks = Math.max(3, Math.min(25, Math.ceil(totalDist / targetChunkLen)));

  // Calculate cumulative distances along the true road polyline
  const cumDists = [0];
  for (let i = 1; i < rawPoints.length; i++) {
    const d = calculateDistanceMeters(
      rawPoints[i - 1][0], rawPoints[i - 1][1],
      rawPoints[i][0], rawPoints[i][1]
    );
    cumDists.push(cumDists[i - 1] + d);
  }
  const measuredTotal = cumDists[cumDists.length - 1] || totalDist;

  // Extract road step names from OSRM legs if available
  const stepRoads = [];
  if (osrmResult.legs && osrmResult.legs[0] && Array.isArray(osrmResult.legs[0].steps)) {
    osrmResult.legs[0].steps.forEach(s => {
      if (s.name && s.name.trim().length > 0 && !stepRoads.includes(s.name.trim())) {
        stepRoads.push(s.name.trim());
      }
    });
  }

  const chunks = [];
  const chunkDistTarget = measuredTotal / numChunks;

  let currentVertexIdx = 0;
  for (let c = 1; c <= numChunks; c++) {
    const chunkTargetDist = c * chunkDistTarget;
    const startIdx = currentVertexIdx;
    const chunkCoords = [rawPoints[startIdx]];

    while (currentVertexIdx < rawPoints.length - 1 && (cumDists[currentVertexIdx + 1] <= chunkTargetDist || c === numChunks)) {
      currentVertexIdx++;
      chunkCoords.push(rawPoints[currentVertexIdx]);
    }

    // Ensure at least 2 points in chunk
    if (chunkCoords.length < 2 && currentVertexIdx < rawPoints.length - 1) {
      currentVertexIdx++;
      chunkCoords.push(rawPoints[currentVertexIdx]);
    }

    const chunkLen = cumDists[currentVertexIdx] - cumDists[startIdx];
    const roadName = stepRoads[c - 1] || stepRoads[0] || (c % 2 === 0 ? 'Main Corridor' : 'City Express Avenue');
    const chunkId = `CHUNK_${100 + c}`;

    chunks.push({
      chunkId,
      roadName,
      roadType: c % 3 === 0 ? 'highway' : 'primary',
      lengthMeters: Math.max(150, Math.round(chunkLen || chunkDistTarget)),
      freeFlowSpeedKmh: c % 3 === 0 ? 60 : 45,
      hasSignal: c % 2 === 0,
      coordinates: chunkCoords
    });
  }

  return chunks.length > 0 ? chunks : null;
}

/**
 * Generate interpolated road corridor chunks (200m - 500m each) between origin and destination
 */
function generateCorridorChunks(origin, destination, detourActive = false) {
  const totalDirectDist = calculateDistanceMeters(origin.lat, origin.lng, destination.lat, destination.lng);
  const targetChunkLen = 350; // target ~350m per chunk
  const numChunks = Math.max(3, Math.min(25, Math.ceil(totalDirectDist / targetChunkLen)));

  const roadNames = [
    'Outer Ring Road',
    'Hosur Main Road',
    '100 Feet Road Corridor',
    'Residency Road Expressway',
    'Bannerghatta Highway',
    'HAL Airport Road',
    'Sarjapur Central Avenue'
  ];

  const chunks = [];
  let prevLat = origin.lat;
  let prevLng = origin.lng;

  // If detour is active, introduce a geographic waypoint deviation to avoid incident chunk
  const detourLatOffset = detourActive ? 0.0065 : 0.0;
  const detourLngOffset = detourActive ? -0.0055 : 0.0;

  for (let i = 1; i <= numChunks; i++) {
    const fraction = i / numChunks;
    // Detour bell curve peak at middle chunks
    const detourWeight = detourActive ? Math.sin(fraction * Math.PI) : 0;

    const currentLat = origin.lat + (destination.lat - origin.lat) * fraction + (detourLatOffset * detourWeight);
    const currentLng = origin.lng + (destination.lng - origin.lng) * fraction + (detourLngOffset * detourWeight);

    const chunkDist = calculateDistanceMeters(prevLat, prevLng, currentLat, currentLng);
    const roadIndex = (i - 1) % roadNames.length;
    const roadName = detourActive && detourWeight > 0.5 
      ? `Detour via ${roadNames[(roadIndex + 2) % roadNames.length]}`
      : roadNames[roadIndex];

    const chunkId = `CHUNK_${100 + i}`;

    chunks.push({
      chunkId,
      roadName,
      roadType: i % 3 === 0 ? 'highway' : 'primary',
      lengthMeters: Math.max(200, Math.min(500, chunkDist)),
      freeFlowSpeedKmh: i % 3 === 0 ? 65 : 45,
      hasSignal: i % 2 === 0,
      coordinates: [
        [parseFloat(prevLat.toFixed(6)), parseFloat(prevLng.toFixed(6))],
        [parseFloat(currentLat.toFixed(6)), parseFloat(currentLng.toFixed(6))]
      ]
    });

    prevLat = currentLat;
    prevLng = currentLng;
  }

  return chunks;
}

/**
 * Orchestrate Dynamic Directions Request
 */
async function getDynamicDirections({ origin, destination, mode = 'car', simulatedIncident = null, userId = null }) {
  logger.info(`Processing dynamic directions request: mode=${mode}, user=${userId || 'anonymous'}`);

  // Check if simulated incident specifies a roadblock requiring reroute detour
  const isRoadblock = simulatedIncident && (simulatedIncident.type === 'roadblock' || simulatedIncident.severity === 'critical');

  let corridorChunks = null;

  // Step 1: Try real OSRM road network geometry when no detour is active
  if (!isRoadblock) {
    try {
      const osrmResult = await getOsrmRoute(origin, destination, mode);
      if (osrmResult && osrmResult.geometry && osrmResult.geometry.coordinates) {
        corridorChunks = createChunksFromOsrmRoute(osrmResult);
      }
    } catch (osrmErr) {
      logger.warn(`OSRM geometry retrieval failed: ${osrmErr.message}. Falling back to corridor interpolation.`);
    }
  }

  // Fallback to geometric corridor if OSRM is offline or roadblock detour is active
  if (!corridorChunks || corridorChunks.length === 0) {
    corridorChunks = generateCorridorChunks(origin, destination, isRoadblock);
  }

  // Step 2: Apply ML prediction to all chunks (Member 1 integration)
  corridorChunks = mlAdapter.predictBatch(corridorChunks);

  // Step 3: Check database for active reported incidents matching any chunk
  let activeIncident = simulatedIncident;
  if (!activeIncident) {
    for (const chunk of corridorChunks) {
      const dbIncident = await incidentService.getActiveIncidentForChunk(chunk.chunkId);
      if (dbIncident) {
        activeIncident = {
          chunkId: dbIncident.chunk_id,
          type: dbIncident.incident_type,
          severity: dbIncident.severity
        };
        break;
      }
    }
  }

  // If incident hits a specific chunk, adjust ML traffic prediction on that chunk to reflect the slowdown
  if (activeIncident && activeIncident.chunkId) {
    const targetChunk = corridorChunks.find(c => c.chunkId === activeIncident.chunkId);
    if (targetChunk) {
      targetChunk.congestionLevel = 'severe';
      targetChunk.color = mlAdapter.CONGESTION_LEVELS.SEVERE.color;
      targetChunk.predictedSpeedKmh = Math.max(4, Math.round(targetChunk.predictedSpeedKmh * 0.25));
    }
  }

  // Step 4: Solve dynamic route with dynamic cost optimization (Member 2 integration)
  const routeResult = routingAdapter.solveDynamicRoute({
    chunks: corridorChunks,
    mode,
    incident: activeIncident
  });

  // Step 5: If user is authenticated, persist trip in route history
  if (userId) {
    try {
      await historyService.logRouteHistory(userId, {
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        origin_name: 'Origin Location',
        dest_lat: destination.lat,
        dest_lng: destination.lng,
        dest_name: 'Destination Location',
        transport_mode: mode,
        total_distance_meters: routeResult.summary.totalDistanceMeters,
        total_duration_seconds: routeResult.summary.totalDurationSeconds,
        traditional_duration_seconds: routeResult.summary.traditionalDurationSeconds,
        time_saved_seconds: routeResult.summary.timeSavedSeconds,
        simulated_incident: activeIncident
      });
    } catch (historyErr) {
      logger.warn(`Failed to auto-log route history: ${historyErr.message}`);
    }
  }

  return routeResult;
}

module.exports = {
  getDynamicDirections,
  calculateDistanceMeters,
  generateCorridorChunks
};
