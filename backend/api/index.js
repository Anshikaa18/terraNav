/**
 * TerraNav AI — Master API Router Gateway
 * Member 3: Backend Integration & Microservices
 */

const express = require('express');
const router = express.Router();

const { requireAuth, optionalAuth } = require('./_lib/auth');
const db = require('./_lib/db');
const { sendSuccess } = require('./_lib/errors');

// Controllers
const authController = require('./auth/controller');
const savedController = require('./saved/controller');
const historyController = require('./history/controller');
const incidentController = require('./incidents/controller');
const directionsController = require('./directions/controller');
const placesController = require('./places/controller');

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
      ml: 'REAL (ChunkFlow ML Traffic Predictor)',
      routing: 'REAL (Dynamic Multi-Cost Optimizer)',
      nominatim: 'REAL (OpenStreetMap Geocoder)',
      overpass: 'REAL (OSM POI Engine)',
      valhalla_osrm: 'REAL (Navigation Fallback)'
    }
  }, 'TerraNav AI Backend API Gateway is fully operational');
});

// ------------------------------------------------------------------------------
// 2. Authentication Routes (/api/auth)
// ------------------------------------------------------------------------------
const authRouter = express.Router();
authRouter.post('/register', authController.register);
authRouter.post('/login', authController.login);
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
historyRouter.get('/:id', requireAuth, historyController.getById);
historyRouter.delete('/:id', requireAuth, historyController.remove);
router.use('/history', historyRouter);

// ------------------------------------------------------------------------------
// 5. Incidents Routes (/api/incidents)
// ------------------------------------------------------------------------------
const incidentRouter = express.Router();
incidentRouter.get('/', incidentController.list);
incidentRouter.post('/', optionalAuth, incidentController.create);
incidentRouter.get('/:id', incidentController.getById);
incidentRouter.put('/:id/status', requireAuth, incidentController.updateStatus);
incidentRouter.delete('/:id', requireAuth, incidentController.remove);
router.use('/incidents', incidentRouter);

// ------------------------------------------------------------------------------
// 6. Central Dynamic Directions Endpoint (/api/directions)
// ------------------------------------------------------------------------------
const directionsRouter = express.Router();
directionsRouter.post('/dynamic', optionalAuth, directionsController.getDynamicRoute);
router.use('/directions', directionsRouter);

// ------------------------------------------------------------------------------
// 7. External Services & Places Proxies (/api/services & /api/places)
// ------------------------------------------------------------------------------
const servicesRouter = express.Router();
servicesRouter.get('/geocode', placesController.geocode);
servicesRouter.get('/reverse', placesController.reverseGeocode);
servicesRouter.get('/poi', placesController.searchPOIs);
servicesRouter.post('/fallback-route', placesController.fallbackRoute);

router.use('/services', servicesRouter);
router.use('/places', servicesRouter); // alias for backwards compatibility

module.exports = router;
