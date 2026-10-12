/**
 * TerraNav AI — Dynamic Directions Controller
 * Member 3: Backend Integration & Microservices
 */

const directionsService = require('./service');
const { validateDynamicDirectionsRequest } = require('../_lib/validation');
const { sendSuccess } = require('../_lib/errors');

async function getDynamicRoute(req, res, next) {
  try {
    const validatedInput = validateDynamicDirectionsRequest(req.body);
    const userId = req.user ? req.user.id : null;

    const routeData = await directionsService.getDynamicDirections({
      origin: validatedInput.origin,
      destination: validatedInput.destination,
      mode: validatedInput.mode,
      simulatedIncident: validatedInput.simulatedIncident,
      userId
    });

    // Return the required frontend-compatible root structure with summary, chunks, steps
    // while also supporting wrapped status
    return res.status(200).json(routeData);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getDynamicRoute
};
