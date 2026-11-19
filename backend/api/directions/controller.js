/**
 * ChunkFlow AI — Dynamic Directions Controller
 * Member 3: Backend Integration & Microservices
 */

const directionsService = require('./service');
const { validateDynamicDirectionsRequest } = require('../_lib/validation');
const { UnauthorizedError, ServiceUnavailableError } = require('../_lib/errors');
const crypto = require('crypto');

async function getDynamicRoute(req, res, next) {
  try {
    const validatedInput = validateDynamicDirectionsRequest(req.body);
    const userId = req.user ? req.user.id : null;

    const routeData = await directionsService.getDynamicDirections({
      origin: validatedInput.origin,
      destination: validatedInput.destination,
      mode: validatedInput.mode,
      originName: req.body.originName,
      destinationName: req.body.destinationName,
      simulatedIncident: validatedInput.simulatedIncident,
      strategy: req.body.strategy || 'provider',
      userId
    });

    return res.status(200).json(routeData);
  } catch (err) {
    return next(err);
  }
}

async function evaluateReroute(req, res, next) {
  try {
    const { currentNode, current_node, origin, destination, currentTimestamp, current_timestamp, tripId, trip_id } = req.body || {};
    const node = currentNode || current_node || origin;
    if (!node || !destination) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_PARAMETERS',
        error: 'currentNode (or origin) and destination are required for reroute evaluation.'
      });
    }

    const decision = await directionsService.evaluateReroute({
      currentNode: node,
      destination,
      currentTimestamp: currentTimestamp || current_timestamp,
      tripId: tripId || trip_id
    });

    return res.status(decision.ok === false ? 503 : 200).json(decision);
  } catch (err) {
    return next(err);
  }
}

async function updateTraffic(req, res, next) {
  try {
    const expectedToken = process.env.TERRANAV_TRAFFIC_UPDATE_TOKEN;
    if (!expectedToken) {
      throw new ServiceUnavailableError('Traffic updates are disabled until a trusted ingestion token is configured.');
    }
    const suppliedToken = req.get('x-terranav-traffic-token') || '';
    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      throw new UnauthorizedError('A valid traffic ingestion token is required.');
    }
    const updates = Array.isArray(req.body) ? req.body : req.body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_PAYLOAD',
        error: 'Payload must contain a non-empty updates array.'
      });
    }

    const result = await directionsService.updateGraphTraffic(updates);
    return res.status(result.ok === false ? 400 : 200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getNetworkInfo(req, res, next) {
  try {
    const info = await directionsService.getNetworkInfo();
    return res.status(200).json(info);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDynamicRoute,
  evaluateReroute,
  updateTraffic,
  getNetworkInfo
};
