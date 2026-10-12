/**
 * TerraNav AI — External Services Controller
 * Member 3: Backend Integration & Microservices
 */

const geocoding = require('../_lib/geocoding');
const poi = require('../_lib/poi');
const navigation = require('../_lib/navigation');
const { sendSuccess } = require('../_lib/errors');

async function geocode(req, res, next) {
  try {
    const { q, limit } = req.query;
    const results = await geocoding.searchPlaces(q, limit);
    return sendSuccess(res, results, 'Geocoding search completed', 200, { count: results.length });
  } catch (err) {
    return next(err);
  }
}

async function reverseGeocode(req, res, next) {
  try {
    const { lat, lng } = req.query;
    const result = await geocoding.reverseGeocode(lat, lng);
    return sendSuccess(res, result, 'Reverse geocoding completed', 200);
  } catch (err) {
    return next(err);
  }
}

async function searchPOIs(req, res, next) {
  try {
    const { lat, lng, radius, category } = req.query;
    const results = await poi.searchNearbyPOIs({ lat, lng, radiusMeters: radius, category });
    return sendSuccess(res, results, 'Nearby POIs retrieved', 200, { count: results.length });
  } catch (err) {
    return next(err);
  }
}

async function fallbackRoute(req, res, next) {
  try {
    const { origin, destination, mode } = req.body;
    const result = await navigation.getValhallaRoute(origin, destination, mode);
    return sendSuccess(res, result, 'Fallback route computed', 200);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  geocode,
  reverseGeocode,
  searchPOIs,
  fallbackRoute
};
