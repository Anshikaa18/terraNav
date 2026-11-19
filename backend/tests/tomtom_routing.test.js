const assert = require('assert');
const axios = require('axios');
const navigation = require('../api/_lib/navigation');
const routingAdapter = require('../api/directions/routingAdapter');

async function run() {
  const originalGet = axios.get;
  const savedKey = process.env.TOMTOM_API_KEY;
  process.env.TOMTOM_API_KEY = 'test-routing-key';
  try {
    let requestedUrl = '';
    axios.get = async url => {
      requestedUrl = url;
      return { data: { routes: [{
        summary: {
          lengthInMeters: 1200,
          travelTimeInSeconds: 240,
          trafficDelayInSeconds: 30,
          noTrafficTravelTimeInSeconds: 210,
          historicTrafficTravelTimeInSeconds: 225,
          liveTrafficIncidentsTravelTimeInSeconds: 240,
          departureTime: '2026-10-24T12:00:00Z',
          arrivalTime: '2026-10-24T12:04:00Z'
        },
        legs: [{ points: [{ longitude: 77.6, latitude: 12.9 }, { longitude: 77.61, latitude: 12.91 }] }],
        guidance: { instructions: [] }
      }] } };
    };
    const routes = await navigation.getTomTomRoutes({ lat: 12.9, lng: 77.6 }, { lat: 12.91, lng: 77.61 }, 'motorcycle');
    const url = new URL(requestedUrl);
    assert.equal(url.searchParams.get('travelMode'), 'motorcycle');
    assert.equal(url.searchParams.get('traffic'), 'true');
    assert.equal(url.searchParams.get('computeTravelTimeFor'), 'all');
    assert.equal(routes[0].durationSeconds, 240);
    assert.equal(routes[0].trafficMetrics.liveTrafficDurationSeconds, 240);
    assert.equal(routes[0].trafficMetrics.noTrafficDurationSeconds, 210);
    await assert.rejects(
      navigation.getTomTomRoutes({ lat: 12.9, lng: 77.6 }, { lat: 12.91, lng: 77.61 }, 'unicycle'),
      /No TomTom travel profile/
    );
    axios.get = async () => ({ data: { routes: [{
      summary: { lengthInMeters: 1200, travelTimeInSeconds: 240 },
      sections: [{ sectionType: 'TRAVEL_MODE', travelMode: 'other' }],
      legs: [{ points: [{ longitude: 77.6, latitude: 12.9 }, { longitude: 77.61, latitude: 12.91 }] }]
    }] } });
    await assert.rejects(
      navigation.getTomTomRoutes({ lat: 12.9, lng: 77.6 }, { lat: 12.91, lng: 77.61 }, 'bicycle'),
      /cannot route the full requested trip/
    );

    const tomtomCost = routingAdapter.calculateChunkCost({
      providerDurationSeconds: 100,
      providerTrafficIncluded: true,
      valueType: 'observed',
      observedSpeedKmh: 10,
      freeFlowSpeedKmh: 30
    }, 'car');
    assert.equal(tomtomCost.durationSeconds, 100, 'TomTom traffic duration must not receive a second flow-speed multiplier');
    const providerOnlyCost = routingAdapter.calculateChunkCost({
      providerDurationSeconds: 100,
      providerTrafficIncluded: false,
      valueType: 'observed',
      observedSpeedKmh: 10,
      freeFlowSpeedKmh: 30
    }, 'car');
    assert.equal(providerOnlyCost.durationSeconds, 300, 'a non-traffic router may use direction-matched live speed');
    console.log('TomTom routing checks passed: real traffic parameters, metrics, and no double-counted ETA');
  } finally {
    axios.get = originalGet;
    if (savedKey === undefined) delete process.env.TOMTOM_API_KEY; else process.env.TOMTOM_API_KEY = savedKey;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
