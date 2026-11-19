/**
 * ChunkFlow AI — External Navigation Service Adapters (TomTom, OSRM & Valhalla)
 * Member 3: Backend Integration & Microservices
 */

const axios = require('axios');
const logger = require('./logging');
const { BadGatewayError } = require('./errors');

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';
const VALHALLA_BASE_URL = process.env.VALHALLA_BASE_URL || 'http://localhost:8002';
const TOMTOM_ROUTING_URL = 'https://api.tomtom.com/routing/1/calculateRoute';
const HTTP_TIMEOUT_MS = 8000;

const TOMTOM_TRAVEL_MODES = {
  car: 'car',
  driving: 'car',
  motorcycle: 'motorcycle',
  bike: 'motorcycle',
  bicycle: 'bicycle',
  cycling: 'bicycle',
  pedestrian: 'pedestrian',
  walking: 'pedestrian'
};

const VALHALLA_COSTING_BY_MODE = {
  motorcycle: 'motorcycle',
  bike: 'motorcycle',
  bicycle: 'bicycle',
  cycling: 'bicycle',
  pedestrian: 'pedestrian',
  walking: 'pedestrian'
};

/**
 * Fetch macro route from TomTom Routing API.
 * Supports car, motorcycle (Bike), bicycle, and pedestrian (Walk) with full road-following geometry.
 */
async function getTomTomRoutes(origin, destination, mode = 'car') {
  const apiKey = process.env.TOMTOM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('TOMTOM_API_KEY is not configured on backend.');
  }

  const normalizedMode = String(mode).toLowerCase();
  const travelMode = TOMTOM_TRAVEL_MODES[normalizedMode];
  if (!travelMode) throw new Error(`No TomTom travel profile is configured for mode "${mode}".`);
  const params = new URLSearchParams({
    key: apiKey,
    travelMode,
    instructionsType: 'tagged',
    routeType: 'fastest',
    traffic: 'true',
    computeTravelTimeFor: 'all',
    maxAlternatives: '2'
  });
  const url = `${TOMTOM_ROUTING_URL}/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json?${params}`;

  const response = await axios.get(url, { timeout: HTTP_TIMEOUT_MS });
  const routes = response.data?.routes;
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error('No route returned by TomTom routing service.');
  }

  const normalizedRoutes = routes.slice(0, 3).map((route, index) => {
    const unsupportedModeSections = (route.sections || []).filter(section =>
      String(section.sectionType || '').toUpperCase() === 'TRAVEL_MODE'
      && String(section.travelMode || '').toLowerCase() === 'other'
    );
    if (unsupportedModeSections.length) return null;
    const leg = route.legs?.[0] || {};
    const points = leg.points || [];
    const coordinates = points.map(p => [Number(p.longitude), Number(p.latitude)]);

    const instructions = route.guidance?.instructions || [];
    const steps = instructions.map((inst, i, arr) => {
      const next = arr[i + 1];
      const stepDist = next ? (next.routeOffsetInMeters - inst.routeOffsetInMeters) : (route.summary.lengthInMeters - inst.routeOffsetInMeters);
      const stepDuration = next ? (next.travelTimeInSeconds - inst.travelTimeInSeconds) : (route.summary.travelTimeInSeconds - inst.travelTimeInSeconds);
      const pIndex = inst.pointIndex || 0;
      const nextPIndex = next ? next.pointIndex : points.length;
      const stepCoords = points.slice(pIndex, Math.max(pIndex + 2, nextPIndex + 1)).map(p => [Number(p.longitude), Number(p.latitude)]);

      const maneuverType = (inst.maneuver || 'TURN').toLowerCase();
      const modifier = (inst.instructionType || 'continue').toLowerCase();

      return {
        name: inst.street || (inst.message ? inst.message.replace(/<[^>]+>/g, '').trim() : 'Road'),
        distance: Math.max(0, stepDist),
        duration: Math.max(0, stepDuration),
        geometry: {
          type: 'LineString',
          coordinates: stepCoords
        },
        maneuver: {
          type: maneuverType === 'depart' ? 'depart' : (maneuverType === 'arrive' ? 'arrive' : 'turn'),
          modifier,
          instruction: inst.message ? inst.message.replace(/<[^>]+>/g, '').trim() : ''
        }
      };
    });

    if (steps.length === 0 && points.length >= 2) {
      steps.push({
        name: 'Direct route path',
        distance: route.summary.lengthInMeters,
        duration: route.summary.travelTimeInSeconds,
        geometry: { type: 'LineString', coordinates },
        maneuver: { type: 'depart', modifier: 'straight', instruction: 'Proceed along route' }
      });
    }

    return {
      id: `tomtom-${normalizedMode}-${index + 1}`,
      provider: 'TOMTOM',
      distanceMeters: Math.round(route.summary.lengthInMeters),
      durationSeconds: Number.isFinite(Number(route.summary.travelTimeInSeconds))
        ? Math.round(Number(route.summary.travelTimeInSeconds)) : null,
      trafficMetrics: {
        trafficDelaySeconds: Number.isFinite(Number(route.summary.trafficDelayInSeconds)) ? Number(route.summary.trafficDelayInSeconds) : null,
        noTrafficDurationSeconds: Number.isFinite(Number(route.summary.noTrafficTravelTimeInSeconds)) ? Number(route.summary.noTrafficTravelTimeInSeconds) : null,
        historicDurationSeconds: Number.isFinite(Number(route.summary.historicTrafficTravelTimeInSeconds)) ? Number(route.summary.historicTrafficTravelTimeInSeconds) : null,
        liveTrafficDurationSeconds: Number.isFinite(Number(route.summary.liveTrafficIncidentsTravelTimeInSeconds)) ? Number(route.summary.liveTrafficIncidentsTravelTimeInSeconds) : null,
        departureTime: route.summary.departureTime || null,
        arrivalTime: route.summary.arrivalTime || null,
        trafficRequested: true,
        trafficProvider: 'TOMTOM'
      },
      geometry: {
        type: 'LineString',
        coordinates
      },
      legs: [{ steps }]
    };
  }).filter(Boolean);
  if (!normalizedRoutes.length) {
    throw new Error(`TomTom cannot route the full requested trip using the ${travelMode} profile.`);
  }
  return normalizedRoutes;
}

/**
 * Fetch candidate macro routes.
 * Prefers TomTom for multi-modal travel profiles (car, motorcycle, bicycle, pedestrian),
 * falling back to OSRM (car) or Valhalla (non-car) when TomTom is unavailable.
 */
async function getOsrmRoutes(origin, destination, mode = 'car') {
  if (process.env.NODE_ENV === 'test') {
    const testDurations = { car: 120, driving: 120, motorcycle: 100, bike: 100, bicycle: 180, cycling: 180, pedestrian: 300, walking: 300 };
    return [{
      id: 'test-route-1',
      provider: 'TEST_ROUTER',
      distanceMeters: 1000,
      durationSeconds: testDurations[String(mode).toLowerCase()] || 120,
      geometry: { coordinates: [[origin.lng, origin.lat], [(origin.lng + destination.lng) / 2, (origin.lat + destination.lat) / 2], [destination.lng, destination.lat]] },
      legs: [{ steps: [{ name: 'Test road' }] }]
    }];
  }

  const normalizedMode = String(mode).toLowerCase();

  // Primary: Use TomTom Routing if API key is present
  if (process.env.TOMTOM_API_KEY) {
    try {
      const routes = await getTomTomRoutes(origin, destination, normalizedMode);
      if (routes && routes.length > 0) {
        return routes;
      }
    } catch (tomtomErr) {
      logger.warn(`TomTom routing provider fell back (${tomtomErr.message}).`);
    }
  }

  // Fallback 1: For car/driving, use public OSRM
  if (['car', 'driving'].includes(normalizedMode)) {
    const osrmProfile = 'driving';
    const url = `${OSRM_BASE_URL}/route/v1/${osrmProfile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true&alternatives=true`;

    try {
      const response = await axios.get(url, { timeout: HTTP_TIMEOUT_MS });
      if (response.data && response.data.code === 'Ok' && response.data.routes && response.data.routes.length > 0) {
        return response.data.routes.slice(0, 3).map((route, index) => ({
          id: `osrm-${index + 1}`,
          provider: 'OSRM',
          distanceMeters: Math.round(route.distance),
          durationSeconds: Math.round(route.duration),
          geometry: route.geometry,
          legs: route.legs
        }));
      }
      throw new Error(response.data?.message || 'No route returned by OSRM');
    } catch (err) {
      logger.warn(`OSRM navigation provider failed (${err.message}).`);
      throw new BadGatewayError('Routing provider is unavailable. Please try again shortly.');
    }
  }

  // Fallback 2: For non-car modes, try Valhalla if configured
  return getValhallaRoutes(origin, destination, normalizedMode);
}

async function getOsrmRoute(origin, destination, mode = 'car') {
  const routes = await getOsrmRoutes(origin, destination, mode);
  return routes[0];
}

async function getValhallaRoute(origin, destination, mode = 'car') {
  const routes = await getValhallaRoutes(origin, destination, mode);
  return routes[0];
}

async function getValhallaRoutes(origin, destination, mode = 'car') {
  const normalizedMode = String(mode).toLowerCase();
  const costing = VALHALLA_COSTING_BY_MODE[normalizedMode];
  if (!costing) {
    throw new BadGatewayError(`No Valhalla travel profile is configured for mode "${mode}".`);
  }
  const payload = {
    locations: [
      { lat: origin.lat, lon: origin.lng },
      { lat: destination.lat, lon: destination.lng }
    ],
    costing,
    format: 'osrm',
    shape_format: 'geojson',
    directions_options: { units: 'kilometers' }
  };

  try {
    const response = await axios.post(`${VALHALLA_BASE_URL.replace(/\/+$/, '')}/route`, payload, { timeout: HTTP_TIMEOUT_MS });
    const data = response.data;
    if (data?.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      return data.routes.map((route, index) => ({
        id: `valhalla-${String(mode).toLowerCase()}-${index + 1}`,
        provider: 'VALHALLA',
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
        geometry: route.geometry,
        legs: route.legs
      }));
    }
    throw new Error(data?.message || 'No route returned by Valhalla');
  } catch (err) {
    logger.warn(`Valhalla profile ${costing} unavailable at ${VALHALLA_BASE_URL} (${err.message}).`);
    const providerMessage = err.response?.data?.error?.message || err.response?.data?.error || err.response?.data?.message || err.message;
    const rejectedProfile = [400, 404, 422].includes(err.response?.status) && /costing|profile|motorcycle|bicycle|pedestrian/i.test(String(providerMessage));
    throw new BadGatewayError(
      rejectedProfile
        ? `${mode} routing is not available from the configured routing service.`
        : `${mode} routing is temporarily unavailable.`,
      {
        code: rejectedProfile ? 'ROUTING_PROFILE_UNAVAILABLE' : 'VALHALLA_UNAVAILABLE',
        requestedMode: normalizedMode,
        costing,
        suggestedModes: ['car']
      }
    );
  }
}

module.exports = {
  getOsrmRoute,
  getOsrmRoutes,
  getTomTomRoutes,
  getValhallaRoute,
  getValhallaRoutes,
  VALHALLA_COSTING_BY_MODE,
  TOMTOM_TRAVEL_MODES
};
