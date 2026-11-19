/**
 * Server-side TomTom Search adapter.  This module deliberately returns the
 * same public place shape as the Nominatim adapter so callers never need an
 * API key or provider-specific response fields.
 */
const axios = require('axios');

const SEARCH_URL = process.env.TOMTOM_SEARCH_URL || 'https://api.tomtom.com/search/2/search';
const REVERSE_URL = process.env.TOMTOM_REVERSE_GEOCODE_URL || 'https://api.tomtom.com/search/2/reverseGeocode';
const TIMEOUT_MS = Number(process.env.TOMTOM_SEARCH_TIMEOUT_MS || 5000);

function distanceMeters(lat1, lon1, lat2, lon2) {
  const r = 6371e3;
  const rad = value => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function isIndia(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6.5 && lat <= 37.5 && lng >= 68 && lng <= 97.5;
}

function publicAddress(address = {}) {
  return {
    ...address,
    display_name: address.freeformAddress || null
  };
}

function normalizeResult(item, origin = null) {
  const latitude = Number(item?.position?.lat);
  const longitude = Number(item?.position?.lon);
  const distance = Number.isFinite(Number(item?.dist))
    ? Number(item.dist)
    : (origin && Number.isFinite(latitude) && Number.isFinite(longitude)
      ? distanceMeters(origin.lat, origin.lng, latitude, longitude)
      : null);
  const address = publicAddress(item?.address);
  const poiName = item?.poi?.name;
  return {
    placeId: item?.id || null,
    displayName: poiName ? `${poiName}${address.freeformAddress ? `, ${address.freeformAddress}` : ''}`
      : (address.freeformAddress || address.municipality || 'Selected Map Location'),
    latitude,
    longitude,
    type: item?.type || 'place',
    category: item?.poi?.categories?.[0] || item?.type || null,
    importance: Number.isFinite(Number(item?.score)) ? Number(item.score) : null,
    distanceMeters: distance,
    distanceKm: distance != null ? Number((distance / 1000).toFixed(1)) : null,
    address,
    provider: 'tomtom'
  };
}

function withinRadius(result, origin, radiusMeters) {
  if (!origin || !Number.isFinite(Number(result.distanceMeters))) return true;
  return result.distanceMeters <= radiusMeters;
}

function requireKey() {
  const key = process.env.TOMTOM_API_KEY;
  if (!key) {
    const error = new Error('TOMTOM_API_KEY is not configured');
    error.code = 'TOMTOM_KEY_MISSING';
    throw error;
  }
  return key;
}

async function search(query, limit, origin = null) {
  const key = requireKey();
  const params = {
    key,
    limit: Math.min(10, Math.max(1, Number(limit) || 5)),
    countrySet: origin && isIndia(origin.lat, origin.lng) ? 'IN' : undefined,
    lat: origin?.lat,
    lon: origin?.lng
  };
  const response = await axios.get(`${SEARCH_URL}/${encodeURIComponent(query)}.json`, { params, timeout: TIMEOUT_MS });
  return (Array.isArray(response.data?.results) ? response.data.results : []).map(item => normalizeResult(item, origin));
}

/**
 * Finds actual places of a category around a point through TomTom Search.
 * TomTom's radius parameter is a hint, so the distance check keeps the public
 * API's radius contract precise when a result lands outside the circle.
 */
async function searchNearby(query, limit, origin, radiusMeters) {
  const key = requireKey();
  const safeLimit = Math.min(30, Math.max(1, Number(limit) || 15));
  const safeRadius = Math.min(50_000, Math.max(200, Number(radiusMeters) || 1_500));
  const params = {
    key,
    limit: safeLimit,
    lat: origin?.lat,
    lon: origin?.lng,
    radius: safeRadius,
    countrySet: origin && isIndia(origin.lat, origin.lng) ? 'IN' : undefined,
    typeahead: true
  };
  const response = await axios.get(`${SEARCH_URL}/${encodeURIComponent(query)}.json`, { params, timeout: TIMEOUT_MS });
  return (Array.isArray(response.data?.results) ? response.data.results : [])
    .filter(item => item?.poi)
    .map(item => normalizeResult(item, origin))
    .filter(result => Number.isFinite(result.latitude) && Number.isFinite(result.longitude))
    .filter(result => withinRadius(result, origin, safeRadius))
    .slice(0, safeLimit);
}

async function reverse(lat, lng) {
  const key = requireKey();
  const response = await axios.get(`${REVERSE_URL}/${Number(lat)},${Number(lng)}.json`, {
    params: { key, language: 'en-US' },
    timeout: TIMEOUT_MS
  });
  const item = Array.isArray(response.data?.addresses) ? response.data.addresses[0] : null;
  if (!item) return null;
  return normalizeResult(item, { lat: Number(lat), lng: Number(lng) });
}

module.exports = { search, searchNearby, reverse, normalizeResult, isIndia };
