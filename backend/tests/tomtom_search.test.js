const assert = require('assert');
const axios = require('axios');
const geocoding = require('../api/_lib/geocoding');

const originalGet = axios.get;
const savedEnv = {
  key: process.env.TOMTOM_API_KEY,
  provider: process.env.GEOCODING_PROVIDER,
  nodeEnv: process.env.NODE_ENV
};

async function run() {
  let passed = 0;
  const check = (condition, name) => { assert.ok(condition, name); console.log(`  ✓ PASS: ${name}`); passed += 1; };
  try {
    process.env.NODE_ENV = 'test';
    process.env.GEOCODING_PROVIDER = 'tomtom';
    process.env.TOMTOM_API_KEY = 'test-key';
    const calls = [];
    axios.get = async (url, options) => {
      calls.push({ url, params: options.params });
      if (url.includes('reverseGeocode')) {
        return { data: { addresses: [{ address: { freeformAddress: 'GE Road, Raipur', municipality: 'Raipur' }, position: { lat: 21.251, lon: 81.63 } }] } };
      }
      return { data: { results: [{ id: 'tomtom-place-1', type: 'POI', score: 0.98, dist: 145, poi: { name: 'Raipur Railway Station', categories: ['railway station'] }, address: { freeformAddress: 'Station Road, Raipur', municipality: 'Raipur' }, position: { lat: 21.256, lon: 81.633 } }] } };
    };
    const results = await geocoding.searchPlaces('TomTom Raipur station test', 4, 21.251, 81.63);
    check(results[0].provider === 'tomtom' && results[0].placeId === 'tomtom-place-1', 'TomTom fuzzy search is normalized into ChunkFlow places');
    check(calls[0].url.includes('/search/2/search/') && calls[0].params.countrySet === 'IN' && calls[0].params.lat === 21.251, 'Indian searches use TomTom country and position biasing');

    const reverse = await geocoding.reverseGeocode(21.2511, 81.6301);
    check(reverse.provider === 'tomtom' && reverse.displayName === 'GE Road, Raipur', 'TomTom reverse geocoding is normalized into a ChunkFlow place');

    const poi = require('../api/_lib/poi');
    const nearby = await poi.searchNearbyPOIs({ lat: 21.251, lng: 81.63, category: 'restaurants', radiusMeters: 1000, limit: 5 });
    check(nearby[0].provider === 'tomtom' && nearby[0].name === 'Raipur Railway Station', 'Nearby category suggestions are sourced and normalized from TomTom Search');
    check(calls.at(-1).params.radius === 1000 && calls.at(-1).params.typeahead === true, 'Nearby category suggestions pass TomTom location and radius biasing');

    axios.get = async () => { const error = new Error('rate limited'); error.response = { status: 429 }; throw error; };
    await assert.rejects(
      () => geocoding.searchPlaces('TomTom provider failure test', 2, 21.25, 81.63),
      error => error.statusCode === 502 && error.message.includes('TomTom')
    );
    check(true, 'TomTom search failure is surfaced instead of silently returning OpenStreetMap results');
    console.log(`TomTom search checks passed: ${passed}`);
  } finally {
    axios.get = originalGet;
    if (savedEnv.key === undefined) delete process.env.TOMTOM_API_KEY; else process.env.TOMTOM_API_KEY = savedEnv.key;
    if (savedEnv.provider === undefined) delete process.env.GEOCODING_PROVIDER; else process.env.GEOCODING_PROVIDER = savedEnv.provider;
    if (savedEnv.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedEnv.nodeEnv;
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
