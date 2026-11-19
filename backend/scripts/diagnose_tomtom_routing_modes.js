/** Live routing smoke check for the four displayed TerraNav travel modes. */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const geocoding = require('../api/_lib/geocoding');
const navigation = require('../api/_lib/navigation');

async function main() {
  if (!process.env.TOMTOM_API_KEY) {
    console.error('TOMTOM_API_KEY is missing from backend/.env. No request was made.');
    process.exitCode = 2;
    return;
  }
  const [origin, destination] = await Promise.all([
    geocoding.searchPlaces('Raipur Railway Station', 1, 21.2514, 81.6296),
    geocoding.searchPlaces('Raj Kumar College Raipur', 1, 21.2514, 81.6296)
  ]);
  if (!origin[0] || !destination[0] || origin[0].provider !== 'tomtom' || destination[0].provider !== 'tomtom') {
    console.log(JSON.stringify({ geocoding: 'unavailable', originProvider: origin[0]?.provider || null, destinationProvider: destination[0]?.provider || null }));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({
    origin: { name: origin[0].displayName, latitude: origin[0].latitude, longitude: origin[0].longitude },
    destination: { name: destination[0].displayName, latitude: destination[0].latitude, longitude: destination[0].longitude }
  }));
  for (const mode of ['car', 'motorcycle', 'bicycle', 'pedestrian']) {
    try {
      const routes = await navigation.getOsrmRoutes(
        { lat: origin[0].latitude, lng: origin[0].longitude },
        { lat: destination[0].latitude, lng: destination[0].longitude },
        mode
      );
      const route = routes[0];
      console.log(JSON.stringify({ mode, status: 'available', provider: route.provider, routes: routes.length, distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, liveTrafficDurationSeconds: route.trafficMetrics?.liveTrafficDurationSeconds ?? null, geometryPoints: route.geometry.coordinates.length }));
    } catch (error) {
      console.log(JSON.stringify({ mode, status: 'unavailable', code: error.details?.code || error.code || null, message: error.response?.data?.error?.description || error.response?.data?.message || error.message }));
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
