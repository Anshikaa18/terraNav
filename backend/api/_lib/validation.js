/**
 * TerraNav AI — Request Validation Utilities
 * Member 3: Backend Integration & Microservices
 */

const { BadRequestError } = require('./errors');

const VALID_TRANSPORT_MODES = ['car', 'motorcycle', 'bike', 'pedestrian'];
const VALID_INCIDENT_TYPES = ['accident', 'roadblock', 'construction', 'flooding', 'heavy_traffic', 'other'];

/**
 * Validate latitude and longitude coordinate values
 */
function isValidCoordinate(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  return (
    !isNaN(numLat) &&
    !isNaN(numLng) &&
    numLat >= -90 &&
    numLat <= 90 &&
    numLng >= -180 &&
    numLng <= 180
  );
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate Dynamic Directions Request Body
 */
function validateDynamicDirectionsRequest(body) {
  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Request body must be a valid JSON object');
  }

  const { origin, destination, mode, simulatedIncident } = body;

  // Validate Origin
  if (!origin || typeof origin !== 'object') {
    throw new BadRequestError('Origin is required and must be an object with { lat, lng }');
  }
  if (!isValidCoordinate(origin.lat, origin.lng)) {
    throw new BadRequestError(`Invalid origin coordinates: lat=${origin.lat}, lng=${origin.lng}. Lat must be [-90, 90], Lng [-180, 180]`);
  }

  // Validate Destination
  if (!destination || typeof destination !== 'object') {
    throw new BadRequestError('Destination is required and must be an object with { lat, lng }');
  }
  if (!isValidCoordinate(destination.lat, destination.lng)) {
    throw new BadRequestError(`Invalid destination coordinates: lat=${destination.lat}, lng=${destination.lng}. Lat must be [-90, 90], Lng [-180, 180]`);
  }

  // Validate Mode
  const selectedMode = mode ? String(mode).toLowerCase() : 'car';
  if (!VALID_TRANSPORT_MODES.includes(selectedMode)) {
    throw new BadRequestError(`Invalid transport mode: '${mode}'. Supported modes are: ${VALID_TRANSPORT_MODES.join(', ')}`);
  }

  // Validate Simulated Incident if provided
  if (simulatedIncident) {
    if (typeof simulatedIncident !== 'object') {
      throw new BadRequestError('simulatedIncident must be an object');
    }
    if (!simulatedIncident.chunkId && !simulatedIncident.location) {
      throw new BadRequestError('simulatedIncident must specify chunkId (e.g. "CHUNK_104") or location coordinates');
    }
    if (simulatedIncident.type && !VALID_INCIDENT_TYPES.includes(String(simulatedIncident.type).toLowerCase())) {
      throw new BadRequestError(`Invalid incident type: '${simulatedIncident.type}'. Supported types: ${VALID_INCIDENT_TYPES.join(', ')}`);
    }
  }

  return {
    origin: { lat: Number(origin.lat), lng: Number(origin.lng) },
    destination: { lat: Number(destination.lat), lng: Number(destination.lng) },
    mode: selectedMode === 'bike' ? 'motorcycle' : selectedMode, // normalize bike -> motorcycle
    simulatedIncident: simulatedIncident ? {
      chunkId: simulatedIncident.chunkId ? String(simulatedIncident.chunkId).trim() : undefined,
      type: simulatedIncident.type ? String(simulatedIncident.type).toLowerCase() : 'accident',
      severity: simulatedIncident.severity || 'high',
      location: simulatedIncident.location && isValidCoordinate(simulatedIncident.location.lat, simulatedIncident.location.lng)
        ? { lat: Number(simulatedIncident.location.lat), lng: Number(simulatedIncident.location.lng) }
        : undefined
    } : null
  };
}

module.exports = {
  isValidCoordinate,
  isValidEmail,
  VALID_TRANSPORT_MODES,
  VALID_INCIDENT_TYPES,
  validateDynamicDirectionsRequest
};
