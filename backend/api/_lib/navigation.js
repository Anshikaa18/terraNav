/**
 * TerraNav AI — External Navigation Service Adapters (Valhalla & OSRM)
 * Member 3: Backend Integration & Microservices
 */

const axios = require('axios');
const logger = require('./logging');
const { BadGatewayError } = require('./errors');

const OSRM_BASE_URL = process.env.OSRM_BASE_URL || 'http://router.project-osrm.org';
const VALHALLA_BASE_URL = process.env.VALHALLA_BASE_URL || 'http://localhost:8002';
const HTTP_TIMEOUT_MS = 6000;

/**
 * Fetch Macro Route from OSRM
 */
async function getOsrmRoute(origin, destination, mode = 'car') {
  const osrmProfile = mode === 'pedestrian' ? 'foot' : (mode === 'bike' || mode === 'motorcycle' ? 'bike' : 'driving');
  const url = `${OSRM_BASE_URL}/route/v1/${osrmProfile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await axios.get(url, { timeout: HTTP_TIMEOUT_MS });
    if (response.data && response.data.code === 'Ok' && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      return {
        provider: 'OSRM',
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
        geometry: route.geometry,
        legs: route.legs
      };
    }
    throw new Error(response.data.message || 'No route returned by OSRM');
  } catch (err) {
    logger.warn(`OSRM navigation provider failed (${err.message}). Using fallback routing calculation.`);
    return {
      provider: 'OSRM_FALLBACK',
      distanceMeters: 5500,
      durationSeconds: 900,
      status: 'fallback'
    };
  }
}

/**
 * Fetch Macro Route from Valhalla
 */
async function getValhallaRoute(origin, destination, mode = 'car') {
  const costingMap = {
    car: 'auto',
    motorcycle: 'motorcycle',
    pedestrian: 'pedestrian',
    bike: 'bicycle'
  };

  const payload = {
    locations: [
      { lat: origin.lat, lon: origin.lng },
      { lat: destination.lat, lon: destination.lng }
    ],
    costing: costingMap[mode] || 'auto',
    directions_options: { units: 'kilometers' }
  };

  try {
    const response = await axios.post(`${VALHALLA_BASE_URL}/route`, payload, { timeout: HTTP_TIMEOUT_MS });
    if (response.data && response.data.trip) {
      const trip = response.data.trip;
      return {
        provider: 'VALHALLA',
        distanceMeters: Math.round(trip.summary.length * 1000),
        durationSeconds: Math.round(trip.summary.time),
        status: 'success'
      };
    }
    throw new Error('No trip summary returned by Valhalla');
  } catch (err) {
    logger.warn(`Valhalla provider unavailable at ${VALHALLA_BASE_URL} (${err.message}). Defaulting to OSRM fallback.`);
    return getOsrmRoute(origin, destination, mode);
  }
}

module.exports = {
  getOsrmRoute,
  getValhallaRoute
};
