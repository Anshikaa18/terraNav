/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const axios = require('axios');
const geocoding = require('../api/_lib/geocoding');

const key = process.env.TOMTOM_API_KEY;
if (!key) {
  console.error('TOMTOM_API_KEY is missing from backend/.env. No request was made.');
  process.exitCode = 2;
} else {
  const timeout = Number(process.env.TOMTOM_SEARCH_TIMEOUT_MS || 5000);
  const checks = [
    { label: 'Raipur Railway Station', query: 'Raipur Railway Station', lat: 21.2514, lon: 81.6296 },
    { label: 'Bengaluru MG Road', query: 'MG Road Bengaluru', lat: 12.9756, lon: 77.6066 }
  ];
  (async () => {
    for (const check of checks) {
      try {
        const response = await axios.get(`https://api.tomtom.com/search/2/search/${encodeURIComponent(check.query)}.json`, {
          params: { key, limit: 3, countrySet: 'IN', lat: check.lat, lon: check.lon }, timeout
        });
        const first = response.data?.results?.[0];
        console.log(JSON.stringify({ label: check.label, operation: 'fuzzy-search', httpStatus: response.status, resultCount: response.data?.results?.length || 0, firstResult: first ? { id: first.id, type: first.type, name: first.poi?.name || null, address: first.address?.freeformAddress || null, position: first.position || null, score: first.score ?? null, distanceMeters: first.dist ?? null } : null }, null, 2));
      } catch (error) {
        console.log(JSON.stringify({ label: check.label, operation: 'fuzzy-search', httpStatus: error.response?.status || null, error: error.code || error.message }, null, 2));
      }
    }
    try {
      const response = await axios.get('https://api.tomtom.com/search/2/reverseGeocode/21.2514,81.6296.json', { params: { key, language: 'en-US' }, timeout });
      const first = response.data?.addresses?.[0];
      console.log(JSON.stringify({ label: 'Raipur GE Road', operation: 'reverse-geocode', httpStatus: response.status, resultCount: response.data?.addresses?.length || 0, firstResult: first ? { address: first.address?.freeformAddress || null, position: first.position || null } : null }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({ label: 'Raipur GE Road', operation: 'reverse-geocode', httpStatus: error.response?.status || null, error: error.code || error.message }, null, 2));
      process.exitCode = 1;
    }
    try {
      const selected = await geocoding.searchPlaces('Raipur Railway Station application-provider check', 1, 21.2514, 81.6296);
      console.log(JSON.stringify({ operation: 'ChunkFlow geocoding-provider selection', resultCount: selected.length, provider: selected[0]?.provider || 'nominatim', firstPlaceId: selected[0]?.placeId || null }, null, 2));
    } catch (error) {
      console.log(JSON.stringify({ operation: 'ChunkFlow geocoding-provider selection', error: error.message }, null, 2));
      process.exitCode = 1;
    }
  })();
}
