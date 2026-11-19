/**
 * ChunkFlow AI — TomTom POI Discovery Adapter
 *
 * The nearby-place API intentionally uses TomTom Search rather than the
 * OpenStreetMap Overpass API. Map tiles can still use OpenStreetMap; this
 * module only controls the places shown in search suggestions and category
 * pills.
 */

const logger = require('./logging');
const { BadRequestError, BadGatewayError } = require('./errors');
const { isValidCoordinate } = require('./validation');
const tomtomSearch = require('./tomtomSearchAdapter');

const poiCache = new Map();
const CATEGORY_QUERIES = {
  restaurants: 'restaurants',
  cafes: 'cafes',
  hospitals: 'hospitals',
  pharmacy: 'pharmacies',
  atms: 'ATMs',
  petrol: 'petrol pumps',
  bus: 'bus stops',
  police: 'police stations',
  hotels: 'hotels',
  temples: 'temples',
  malls: 'shopping malls',
  colleges: 'colleges',
  attractions: 'tourist attractions'
};

function toNearbyPlace(place, requestedCategory) {
  const address = place.address?.freeformAddress
    || place.address?.display_name
    || place.displayName
    || '';
  return {
    id: place.placeId || `tomtom-${place.latitude},${place.longitude}`,
    name: place.displayName?.split(',')[0]?.trim() || 'Unnamed place',
    displayName: place.displayName,
    category: place.category || requestedCategory,
    latitude: place.latitude,
    longitude: place.longitude,
    distanceMeters: place.distanceMeters,
    distanceKm: place.distanceKm,
    address,
    tags: {},
    provider: 'tomtom'
  };
}

/** Search category suggestions around the supplied point with TomTom Search. */
async function searchNearbyPOIs({ lat, lng, radiusMeters = 1500, category = 'petrol', limit = 15 }) {
  if (!isValidCoordinate(lat, lng)) {
    throw new BadRequestError(`Invalid coordinates for POI search: lat=${lat}, lng=${lng}`);
  }

  const radius = Math.min(5000, Math.max(200, parseInt(radiusMeters, 10) || 1500));
  const resultLimit = Math.min(30, Math.max(1, parseInt(limit, 10) || 15));
  const safeCategory = String(category || 'petrol').replace(/[^a-zA-Z0-9_|]/g, '');
  const query = CATEGORY_QUERIES[safeCategory] || safeCategory.replace(/[|_]/g, ' ');
  const cacheKey = `tomtom-poi:${Number(lat).toFixed(5)}:${Number(lng).toFixed(5)}:${radius}:${safeCategory}:${resultLimit}`;

  if (poiCache.has(cacheKey)) return poiCache.get(cacheKey);

  try {
    const results = await tomtomSearch.searchNearby(query, resultLimit, {
      lat: Number(lat),
      lng: Number(lng)
    }, radius);
    const places = results.map(place => toNearbyPlace(place, safeCategory));
    poiCache.set(cacheKey, places);
    return places;
  } catch (err) {
    logger.warn(`TomTom POI query failed (${err.response?.status || err.code || err.message}).`);
    throw new BadGatewayError('TomTom nearby place search is temporarily unavailable. Please try again shortly.');
  }
}

module.exports = { searchNearbyPOIs };
