/**
 * ChunkFlow AI — Master API Router Gateway
 * Member 3: Backend Integration & Microservices
 */

const express = require('express');
const router = express.Router();

const { requireAuth, optionalAuth } = require('./_lib/auth');
const db = require('./_lib/db');
const { sendSuccess, ServiceUnavailableError } = require('./_lib/errors');
const { createRateLimiter } = require('./_lib/rateLimit');

// Controllers
const authController = require('./auth/controller');
const savedController = require('./saved/controller');
const historyController = require('./history/controller');
const incidentController = require('./incidents/controller');
const directionsController = require('./directions/controller');
const placesController = require('./places/controller');
const mapsController = require('./maps/controller');

// ------------------------------------------------------------------------------
// 1. Health Check Endpoint
// ------------------------------------------------------------------------------
router.get('/health', async (req, res) => {
  const dbStatus = db.getPoolStatus();
  return sendSuccess(res, {
    service: 'terranav-backend',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    database: dbStatus,
    integrations: {
      ml: 'Research-only segment model; predictions excluded from live route costs',
      traffic: process.env.TOMTOM_API_KEY
        ? 'TomTom Traffic Flow/Incidents configured'
        : (process.env.HERE_TRAFFIC_API_KEY ? 'HERE Traffic API v7 configured (TomTom not configured)' : 'No live traffic provider configured'),
      routing: 'Provider routes with mode-specific fallbacks and matched traffic where available',
      nominatim: 'REAL (OpenStreetMap Geocoder)',
      overpass: 'REAL (OSM POI Engine)',
      valhalla_osrm: 'OSRM driving and configured Valhalla multimodal fallback'
    }
  }, 'ChunkFlow AI Backend API Gateway is fully operational');
});

router.get('/health/ready', async (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const dbStatus = db.getPoolStatus();
  if (isProduction && !db.isPersistenceReady()) {
    return next(new ServiceUnavailableError('Persistence layer (MySQL) is not ready'));
  }
  return sendSuccess(res, {
    ready: true,
    database: dbStatus
  }, 'Service is ready');
});

const authRateLimit = createRateLimiter({ windowMs: 60_000, max: 30, name: 'auth' });
const geocodeRateLimit = createRateLimiter({ windowMs: 60_000, max: 40, name: 'geocode' });
const incidentCreateRateLimit = createRateLimiter({ windowMs: 60_000, max: 15, name: 'incident-create' });

// ------------------------------------------------------------------------------
// 2. Authentication Routes (/api/auth)
// ------------------------------------------------------------------------------
const authRouter = express.Router();
authRouter.post('/register', authRateLimit, authController.register);
authRouter.post('/login', authRateLimit, authController.login);
authRouter.get('/me', requireAuth, authController.getMe);
router.use('/auth', authRouter);

// ------------------------------------------------------------------------------
// 3. Saved Places Routes (/api/saved)
// ------------------------------------------------------------------------------
const savedRouter = express.Router();
savedRouter.get('/', requireAuth, savedController.list);
savedRouter.post('/', requireAuth, savedController.create);
savedRouter.get('/:id', requireAuth, savedController.getById);
savedRouter.put('/:id', requireAuth, savedController.update);
savedRouter.delete('/:id', requireAuth, savedController.remove);
router.use('/saved', savedRouter);

// ------------------------------------------------------------------------------
// 4. Route History Routes (/api/history)
// ------------------------------------------------------------------------------
const historyRouter = express.Router();
historyRouter.get('/', requireAuth, historyController.list);
historyRouter.post('/', requireAuth, historyController.create);
historyRouter.delete('/', requireAuth, historyController.clear);
historyRouter.get('/:id', requireAuth, historyController.getById);
historyRouter.delete('/:id', requireAuth, historyController.remove);
router.use('/history', historyRouter);

// ------------------------------------------------------------------------------
// 5. Incidents Routes (/api/incidents)
// ------------------------------------------------------------------------------
const incidentRouter = express.Router();
incidentRouter.get('/', incidentController.list);
incidentRouter.post('/', incidentCreateRateLimit, requireAuth, incidentController.create);
incidentRouter.get('/:id', incidentController.getById);
incidentRouter.put('/:id/status', requireAuth, incidentController.updateStatus);
incidentRouter.delete('/:id', requireAuth, incidentController.remove);
router.use('/incidents', incidentRouter);

// ------------------------------------------------------------------------------
// 6. Central Dynamic Directions Endpoint (/api/directions)
// ------------------------------------------------------------------------------
const directionsRouter = express.Router();
directionsRouter.post('/dynamic', optionalAuth, directionsController.getDynamicRoute);
directionsRouter.post('/route', optionalAuth, directionsController.getDynamicRoute);
directionsRouter.post('/reroute', optionalAuth, directionsController.evaluateReroute);
directionsRouter.post('/traffic-update', optionalAuth, directionsController.updateTraffic);
directionsRouter.get('/network', directionsController.getNetworkInfo);
router.use('/directions', directionsRouter);

// ------------------------------------------------------------------------------
// 7. External Services & Places Proxies (/api/services & /api/places)
// ------------------------------------------------------------------------------
const servicesRouter = express.Router();
servicesRouter.get('/geocode', geocodeRateLimit, placesController.geocode);
servicesRouter.get('/reverse', geocodeRateLimit, placesController.reverseGeocode);
servicesRouter.get('/poi', geocodeRateLimit, placesController.searchPOIs);
servicesRouter.post('/fallback-route', placesController.fallbackRoute);

router.use('/services', servicesRouter);
router.use('/places', servicesRouter); // alias for backwards compatibility

// TomTom raster tiles are proxied so the traffic/maps API credential never
// enters frontend code or a browser-visible tile URL.
const mapsRouter = express.Router();
mapsRouter.get('/tomtom/tiles/:z/:x/:y.png', mapsController.tomtomTile);
router.use('/maps', mapsRouter);

module.exports = router;
