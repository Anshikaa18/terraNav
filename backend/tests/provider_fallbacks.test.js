const assert = require('assert');
const axios = require('axios');
const geocoding = require('../api/_lib/geocoding');
const poi = require('../api/_lib/poi');
const navigation = require('../api/_lib/navigation');

async function run() {
  const originalGet = axios.get;
  const originalPost = axios.post;
  const originalTomTomKey = process.env.TOMTOM_API_KEY;
  let passed = 0;
  const check = (condition, name) => {
    assert.ok(condition, name);
    console.log(`  ✓ PASS: ${name}`);
    passed += 1;
  };

  try {
    let requests = [];
    axios.get = async (_url, options) => {
      requests.push(options.params);
      return { data: [{ place_id: 801, display_name: 'MG Road, Bengaluru, India', lat: '12.97', lon: '77.60', address: { city: 'Bengaluru' } }] };
    };
    const india = await geocoding.searchPlaces('MG Road test', 5, 12.97, 77.60);
    check(india[0].placeId === 801 && india[0].address.city === 'Bengaluru', 'Nominatim results and address fields are preserved');
    check(requests[0].countrycodes === 'in' && Boolean(requests[0].viewbox), 'India search is country-focused and geographically biased');

    requests = [];
    const elsewhere = await geocoding.searchPlaces('Central Park test', 40.78, -73.96);
    check(elsewhere.length === 1 && !('countrycodes' in requests[0]), 'A selected location outside India is searched without the India restriction');

    axios.get = async () => { throw new Error('provider offline'); };
    await assert.rejects(() => geocoding.searchPlaces('provider failure test', 5), error => error.statusCode === 502);
    await assert.rejects(() => geocoding.reverseGeocode(13.01, 77.61), error => error.statusCode === 502);
    check(true, 'Nominatim forward and reverse provider errors are reported without fabricated places');

    process.env.TOMTOM_API_KEY = 'test-key';
    let tomtomParams = null;
    axios.get = async (_url, options) => {
      tomtomParams = options.params;
      return { data: { results: [
        { id: 'tomtom-cafe-1', type: 'POI', dist: 550, poi: { name: 'Real Cafe', categories: ['cafe'] }, address: { freeformAddress: 'Example Road' }, position: { lat: 12.971, lon: 77.594 } },
        { id: 'tomtom-cafe-2', type: 'POI', dist: 700, poi: { name: 'Real Restaurant', categories: ['restaurant'] }, address: { freeformAddress: 'Bengaluru' }, position: { lat: 12.972, lon: 77.595 } }
      ] } };
    };
    const places = await poi.searchNearbyPOIs({ lat: 12.97, lng: 77.59, category: 'cafes', radiusMeters: 1000 });
    check(places.length === 2 && places[0].name === 'Real Cafe' && places[0].address === 'Example Road', 'TomTom POI names, addresses, and coordinates are mapped from provider data');
    check(tomtomParams.radius === 1000 && tomtomParams.lat === 12.97 && tomtomParams.lon === 77.59, 'TomTom nearby searches are centered and radius-limited');

    axios.get = async () => ({ data: { results: [] } });
    const empty = await poi.searchNearbyPOIs({ lat: 12.97, lng: 77.59, category: 'hospitals', radiusMeters: 1000 });
    check(empty.length === 0, 'An empty TomTom response remains an empty result');

    axios.get = async () => { throw new Error('provider offline'); };
    await assert.rejects(() => poi.searchNearbyPOIs({ lat: 12.97, lng: 77.59, category: 'pharmacy', radiusMeters: 1000 }), error => error.statusCode === 502);
    check(true, 'TomTom provider errors return an explicit upstream error rather than mock POIs');

    const routeRequests = [];
    axios.post = async (_url, payload) => {
      routeRequests.push(payload);
      return { data: { code: 'Ok', routes: [{ distance: 1400, duration: 260, geometry: { type: 'LineString', coordinates: [[77.59, 12.97], [77.60, 12.98]] }, legs: [{ steps: [] }] }] } };
    };
    const motorcycle = await navigation.getValhallaRoutes({ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.60 }, 'motorcycle');
    const bicycle = await navigation.getValhallaRoutes({ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.60 }, 'bicycle');
    const pedestrian = await navigation.getValhallaRoutes({ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.60 }, 'pedestrian');
    check(routeRequests[0].costing === 'motorcycle' && routeRequests[1].costing === 'bicycle' && routeRequests[2].costing === 'pedestrian', 'Valhalla receives distinct motorcycle, bicycle, and pedestrian profiles');
    check(motorcycle[0].provider === 'VALHALLA' && bicycle[0].geometry.coordinates.length === 2, 'Distinct real-provider route results are normalized with route geometry');

    axios.post = async () => {
      const error = new Error('connection refused');
      error.code = 'ECONNREFUSED';
      throw error;
    };
    await assert.rejects(
      () => navigation.getValhallaRoutes({ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.60 }, 'bicycle'),
      error => error.statusCode === 502 && error.details?.code === 'VALHALLA_UNAVAILABLE'
    );
    check(true, 'Unreachable Valhalla is reported as unavailable rather than substituted with a driving route');

    console.log(`\nProvider checks passed: ${passed}`);
  } finally {
    axios.get = originalGet;
    axios.post = originalPost;
    if (originalTomTomKey === undefined) delete process.env.TOMTOM_API_KEY;
    else process.env.TOMTOM_API_KEY = originalTomTomKey;
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
