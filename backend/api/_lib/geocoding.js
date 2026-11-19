/**
 * ChunkFlow AI — Nominatim Geocoding Adapter
 * Member 3: Backend Integration & Microservices
 */

const axios = require('axios');
const logger = require('./logging');
const { BadRequestError, BadGatewayError } = require('./errors');
const { isValidCoordinate } = require('./validation');
const tomtomSearch = require('./tomtomSearchAdapter');

const NOMINATIM_BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'ChunkFlow-AI-Backend/1.0 (contact@terranav.ai)';
const HTTP_TIMEOUT_MS = 5000;

// Simple in-memory geocoding cache
const geocodeCache = new Map();

function shouldUseTomTom() {
  // Keep deterministic/unit tests offline unless they explicitly select TomTom.
  return Boolean(process.env.TOMTOM_API_KEY)
    && process.env.GEOCODING_PROVIDER !== 'nominatim'
    && (process.env.NODE_ENV !== 'test' || process.env.GEOCODING_PROVIDER === 'tomtom');
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const r = 6371e3;
  const toRad = value => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Forward Geocoding: Search query -> Coordinates & Places
 * Biased by current/selected user location if provided.
 */
async function searchPlaces(query, limit = 5, lat = null, lng = null) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    throw new BadRequestError('Search query string is required');
  }

  const numLat = lat != null && isValidCoordinate(lat, lng != null ? lng : 0) ? Number(lat) : null;
  const numLng = lng != null && isValidCoordinate(numLat != null ? numLat : 0, lng) ? Number(lng) : null;
  const hasCoords = numLat != null && numLng != null;

  // Determine if location is in India (lat: 6.5 to 37.5, lng: 68.0 to 97.5) without hardcoding
  const isIndia = hasCoords && numLat >= 6.5 && numLat <= 37.5 && numLng >= 68.0 && numLng <= 97.5;

  const locKey = hasCoords ? `:${numLat.toFixed(2)},${numLng.toFixed(2)}` : '';
  const provider = shouldUseTomTom() ? 'tomtom' : 'nominatim';
  const cacheKey = `${provider}:search:${query.trim().toLowerCase()}:${limit}${locKey}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  if (provider === 'tomtom') {
    try {
      const results = await tomtomSearch.search(query.trim(), limit, hasCoords ? { lat: numLat, lng: numLng } : null);
      geocodeCache.set(cacheKey, results);
      return results;
    } catch (error) {
      logger.warn(`TomTom search failed (${error.response?.status || error.code || error.message}).`);
      throw new BadGatewayError('TomTom place search is temporarily unavailable. Please try again shortly.');
    }
  }

  const url = `${NOMINATIM_BASE_URL}/search`;

  // Build params with viewbox biasing if coords available
  const baseParams = {
    q: query.trim(),
    format: 'json',
    limit: Math.min(10, Math.max(1, limit)),
    addressdetails: 1
  };

  if (hasCoords) {
    // 0.75 degree (~80km) bounding box for geographic biasing
    baseParams.viewbox = `${numLng - 0.75},${numLat + 0.75},${numLng + 0.75},${numLat - 0.75}`;
    baseParams.bounded = 0; // bias without excluding outer matches
  }

  try {
    let responseData = [];

    // If searching from India, prioritize Indian locations first
    if (isIndia) {
      try {
        const inResponse = await axios.get(url, {
          params: { ...baseParams, countrycodes: 'in' },
          headers: { 'User-Agent': USER_AGENT },
          timeout: HTTP_TIMEOUT_MS
        });
        if (Array.isArray(inResponse.data) && inResponse.data.length > 0) {
          responseData = inResponse.data;
        }
      } catch (inErr) {
        logger.warn(`Nominatim India-biased search failed (${inErr.message}), falling back to global search.`);
      }
    }

    // Fall back to global search if no India results or not searching from India
    if (!responseData || responseData.length === 0) {
      const response = await axios.get(url, {
        params: baseParams,
        headers: { 'User-Agent': USER_AGENT },
        timeout: HTTP_TIMEOUT_MS
      });
      responseData = response.data || [];
    }

    let results = responseData.map(item => {
      const itemLat = parseFloat(item.lat);
      const itemLon = parseFloat(item.lon);
      const distanceMeters = hasCoords ? calculateDistanceMeters(numLat, numLng, itemLat, itemLon) : null;
      return {
        placeId: item.place_id,
        displayName: item.display_name,
        latitude: itemLat,
        longitude: itemLon,
        type: item.type,
        category: item.class,
        importance: item.importance,
        distanceMeters,
        distanceKm: distanceMeters != null ? Number((distanceMeters / 1000).toFixed(1)) : null,
        address: item.address || {}
      };
    });

    // If coordinates provided, sort results by physical proximity to the user's location
    if (hasCoords && results.length > 1) {
      results.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    }

    geocodeCache.set(cacheKey, results);
    return results;
  } catch (err) {
    logger.warn(`Nominatim search failed (${err.message}).`);
    throw new BadGatewayError('Location search is temporarily unavailable. Please try again shortly.');
  }
}

/**
 * Reverse Geocoding: Lat/Lng -> Address
 */
async function reverseGeocode(lat, lng) {
  if (!isValidCoordinate(lat, lng)) {
    throw new BadRequestError(`Invalid coordinates for reverse geocoding: lat=${lat}, lng=${lng}`);
  }

  const provider = shouldUseTomTom() ? 'tomtom' : 'nominatim';
  const cacheKey = `${provider}:reverse:${Number(lat).toFixed(4)}:${Number(lng).toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  if (provider === 'tomtom') {
    try {
      const result = await tomtomSearch.reverse(lat, lng);
      if (result) {
        geocodeCache.set(cacheKey, result);
        return result;
      }
      throw new BadGatewayError('TomTom address lookup returned no address. Please try again shortly.');
    } catch (error) {
      if (error instanceof BadGatewayError) throw error;
      logger.warn(`TomTom reverse geocode failed (${error.response?.status || error.code || error.message}).`);
      throw new BadGatewayError('TomTom address lookup is temporarily unavailable. Please try again shortly.');
    }
  }

  const url = `${NOMINATIM_BASE_URL}/reverse`;
  try {
    const response = await axios.get(url, {
      params: {
        lat: Number(lat),
        lon: Number(lng),
        format: 'json',
        addressdetails: 1
      },
      headers: {
        'User-Agent': USER_AGENT
      },
      timeout: HTTP_TIMEOUT_MS
    });

    const data = response.data;
    const result = {
      placeId: data.place_id,
      displayName: data.display_name || 'Selected Map Location',
      address: data.address || {},
      latitude: parseFloat(data.lat || lat),
      longitude: parseFloat(data.lon || lng)
    };

    geocodeCache.set(cacheKey, result);
    return result;
  } catch (err) {
    logger.warn(`Nominatim reverse geocode failed (${err.message}).`);
    throw new BadGatewayError('Address lookup is temporarily unavailable. Please try again shortly.');
  }
}

module.exports = {
  searchPlaces,
  reverseGeocode
};
