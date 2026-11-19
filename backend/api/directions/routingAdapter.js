/**
 * ChunkFlow AI — Dynamic Routing Engine Adapter
 *
 * Preserves each routing provider's mode-specific ETA. Live road-flow observations
 * adjust motor-vehicle estimates only by the provider's observed/free-flow speed ratio.
 * No fixed-speed or traffic-class delay fallback is used to invent an ETA.
 */
const logger = require('../_lib/logging');

// Mode speed / agility factors
const MODE_PROFILES = {
  car: { usesMotorTraffic: true, filterTraffic: false },
  driving: { usesMotorTraffic: true, filterTraffic: false },
  motorcycle: { usesMotorTraffic: true, filterTraffic: true },
  bike: { usesMotorTraffic: true, filterTraffic: true },
  bicycle: { usesMotorTraffic: false, filterTraffic: false },
  cycling: { usesMotorTraffic: false, filterTraffic: false },
  pedestrian: { usesMotorTraffic: false, filterTraffic: false },
  walking: { usesMotorTraffic: false, filterTraffic: false }
};

// Incident delay penalties in seconds
const INCIDENT_DELAYS = {
  accident: 480,       // 8 min delay
  roadblock: 1800,     // 30 min heavy penalty (triggers detour)
  construction: 300,  // 5 min delay
  flooding: 600,      // 10 min delay
  heavy_traffic: 240, // 4 min delay
  other: 180
};

/**
 * Calculate dynamic traversal duration for a road segment (chunk).
 */
function calculateChunkCost(chunk, mode = 'car', activeIncident = null) {
  const profile = MODE_PROFILES[mode] || MODE_PROFILES.car;
  const providerDuration = Number(chunk.providerDurationSeconds);
  if (!Number.isFinite(providerDuration) || providerDuration < 0) {
    throw new Error('The routing provider did not return a valid duration for this route segment.');
  }
  let baseTravelDuration = providerDuration;
  const observedSpeed = Number(chunk.observedSpeedKmh);
  const freeFlowSpeed = Number(chunk.freeFlowSpeedKmh);
  const predictedSpeed = Number(chunk.predictedSpeedKmh);
  if (!chunk.providerTrafficIncluded && profile.usesMotorTraffic && chunk.valueType === 'observed' && observedSpeed > 0 && freeFlowSpeed > 0) {
    // Scale the selected mode's actual provider ETA by observed/free-flow speed ratio.
    baseTravelDuration *= freeFlowSpeed / observedSpeed;
  } else if (!chunk.providerTrafficIncluded && profile.usesMotorTraffic && chunk.valueType === 'predicted' && predictedSpeed > 0) {
    // Phase 5.1: If prediction available without observation, scale by free-flow or calculate T = 3.6L/v
    if (freeFlowSpeed > 0) {
      baseTravelDuration *= freeFlowSpeed / predictedSpeed;
    } else if (Number(chunk.lengthMeters) > 0) {
      baseTravelDuration = (Number(chunk.lengthMeters) * 3.6) / Math.max(5, predictedSpeed);
    }
  }

  // Incident Delay penalty in seconds
  let incidentPenalty = 0;
  const chunkId = chunk.segmentId || chunk.chunkId;
  if (activeIncident && (activeIncident.chunkId === chunkId || activeIncident.chunk_id === chunkId || activeIncident.chunkId === chunk.legacyChunkId)) {
    const type = (activeIncident.type || activeIncident.incident_type || 'accident').toLowerCase();
    incidentPenalty = INCIDENT_DELAYS[type] || 300;
    if (profile.filterTraffic && (type === 'accident' || type === 'heavy_traffic')) {
      incidentPenalty = Math.round(incidentPenalty * 0.4);
    }
  }

  const totalChunkDuration = baseTravelDuration + incidentPenalty;

  return {
    durationSeconds: Math.round(totalChunkDuration),
    traversalCost: Math.round(totalChunkDuration),
    incidentPenalty: Math.round(incidentPenalty),
    baseTravelSeconds: Math.round(baseTravelDuration),
    queueDelaySeconds: 0,
    signalDelaySeconds: 0
  };
}

/**
 * Generate human-readable navigation steps from raw OSRM steps or synthesized chunks
 */
function generateNavigationSteps(chunks, rawSteps = null) {
  if (Array.isArray(rawSteps) && rawSteps.length > 0) {
    const parsedSteps = [];
    for (let i = 0; i < rawSteps.length; i++) {
      const step = rawSteps[i];
      const distance = Math.round(step.distance || 0);
      const name = step.name && step.name.trim() !== '' ? step.name.trim() : null;
      const maneuver = step.maneuver || {};
      const type = (maneuver.type || '').toLowerCase();
      const modifier = (maneuver.modifier || '').toLowerCase().replace(/_/g, ' ');

      let instruction = '';
      if (type === 'depart') {
        instruction = name ? `Head towards ${name}` : 'Head towards your destination';
      } else if (type === 'arrive') {
        instruction = 'Arrive at your destination';
      } else if (type === 'turn' || type === 'end of road') {
        const turnDir = modifier || 'ahead';
        instruction = name ? `Turn ${turnDir} onto ${name}` : `Turn ${turnDir}`;
      } else if (type === 'continue' || type === 'new name') {
        instruction = name ? `Continue onto ${name}` : 'Continue on current road';
      } else if (type === 'roundabout' || type === 'rotary') {
        const exit = maneuver.exit ? `take exit ${maneuver.exit}` : 'exit';
        instruction = name ? `At the roundabout, ${exit} onto ${name}` : `Enter roundabout and ${exit}`;
      } else if (type === 'fork') {
        instruction = name ? `Keep ${modifier || 'straight'} at the fork towards ${name}` : `Keep ${modifier || 'straight'} at fork`;
      } else {
        instruction = name ? `Continue along ${name}` : 'Follow route ahead';
      }

      parsedSteps.push({
        instruction,
        distance: distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${distance} m`,
        type: type || 'continue',
        modifier: modifier || null,
        roadName: name || 'Road corridor'
      });
    }

    if (parsedSteps.length > 0) return parsedSteps;
  }

  if (!chunks || chunks.length === 0) return [];

  const steps = [];
  let currentRoad = chunks[0].roadName && chunks[0].roadName !== 'Unnamed road' ? chunks[0].roadName : 'Route corridor';
  let accumulatedDist = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    accumulatedDist += chunk.lengthMeters;

    const isLast = (i === chunks.length - 1);
    const nextRoad = !isLast ? chunks[i + 1].roadName : null;

    if (isLast) {
      const destRoad = chunk.roadName && chunk.roadName !== 'Unnamed road' ? chunk.roadName : currentRoad;
      steps.push({
        instruction: `Continue along ${destRoad} to your destination`,
        distance: accumulatedDist >= 1000 ? `${(accumulatedDist / 1000).toFixed(1)} km` : `${accumulatedDist} m`,
        type: 'arrive',
        roadName: destRoad
      });
    } else if (nextRoad && nextRoad !== currentRoad && nextRoad !== 'Unnamed road') {
      steps.push({
        instruction: `Follow ${currentRoad} toward ${nextRoad}`,
        distance: accumulatedDist >= 1000 ? `${(accumulatedDist / 1000).toFixed(1)} km` : `${accumulatedDist} m`,
        type: 'turn',
        roadName: nextRoad
      });
      currentRoad = nextRoad;
      accumulatedDist = 0;
    }
  }

  if (steps.length === 0) {
    steps.push({
      instruction: 'Follow route directly to your destination',
      distance: `${accumulatedDist} m`,
      type: 'arrive',
      roadName: currentRoad
    });
  }

  return steps;
}

/**
 * Calculate dynamic route optimization & honest savings vs baseline
 *
 * @param {Object} params
 * @param {Array} params.chunks
 * @param {string} params.mode
 * @param {Object|null} params.incident
 * @param {number|null} params.baselineDurationSeconds - Independent baseline from routing provider (e.g. OSRM)
 */
function solveDynamicRoute({ chunks, mode = 'car', incident = null, baselineDurationSeconds = null, rawSteps = null }) {
  let totalDistanceMeters = 0;
  let dynamicDurationSeconds = 0;
  const profile = MODE_PROFILES[mode] || MODE_PROFILES.car;

  const processedChunks = chunks.map((chunk, index) => {
    const cost = calculateChunkCost(chunk, mode, incident);
    totalDistanceMeters += chunk.lengthMeters;
    dynamicDurationSeconds += cost.durationSeconds;

    return {
      segmentId: chunk.segmentId || chunk.chunkId,
      chunkId: chunk.chunkId,
      roadName: chunk.roadName || `Corridor Segment ${index + 1}`,
      lengthMeters: chunk.lengthMeters,
      predictedSpeedKmh: chunk.predictedSpeedKmh,
      predictedDensityVehiclesPerKm: chunk.predictedDensityVehiclesPerKm,
      observedSpeedKmh: chunk.observedSpeedKmh ?? null,
      freeFlowSpeedKmh: chunk.freeFlowSpeedKmh ?? null,
      jamFactor: chunk.jamFactor ?? null,
      trafficClass: chunk.trafficClass || 'unknown',
      valueType: chunk.valueType || 'unavailable',
      trafficStatus: chunk.trafficStatus || 'unavailable',
      source: chunk.source || null,
      observedAt: chunk.observedAt || null,
      predictedAt: chunk.predictedAt || null,
      modelVersion: chunk.modelVersion || null,
      predictionStatus: chunk.predictionStatus || 'unavailable',
      predictionError: chunk.predictionError || null,
      confidence: chunk.confidence ?? null,
      costSource: chunk.costSource || 'routing-provider-duration',
      providerDurationSeconds: chunk.providerDurationSeconds,
      effectiveSpeedKmh: chunk.effectiveSpeedKmh || null,
      coordinates: chunk.coordinates
    };
  });

  const traditionalBaseline = Number(baselineDurationSeconds);
  if (baselineDurationSeconds == null || !Number.isFinite(traditionalBaseline) || traditionalBaseline < 0) {
    throw new Error('The routing provider did not return a valid route duration.');
  }

  // Time saved can be positive (faster than baseline), 0, or negative (delayed by congestion/incident)
  const timeSavedSeconds = traditionalBaseline - Math.round(dynamicDurationSeconds);

  return {
    summary: {
      totalDistanceMeters: Math.round(totalDistanceMeters),
      totalDurationSeconds: Math.round(dynamicDurationSeconds),
      traditionalDurationSeconds: traditionalBaseline,
      timeSavedSeconds: Math.round(timeSavedSeconds),
      baselineMethod: 'routing-provider-duration',
      durationSource: processedChunks.some((chunk) => chunk.valueType === 'observed' && profile.usesMotorTraffic)
        ? 'routing-provider-plus-live-traffic'
        : 'routing-provider',
      mode
    },
    chunks: processedChunks,
    steps: generateNavigationSteps(processedChunks, rawSteps)
  };
}

module.exports = {
  calculateChunkCost,
  solveDynamicRoute,
  generateNavigationSteps,
  MODE_PROFILES,
  INCIDENT_DELAYS
};
