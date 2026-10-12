/**
 * TerraNav AI — Saved Places Controller
 * Member 3: Backend Integration & Microservices
 */

const savedService = require('./service');
const { sendSuccess } = require('../_lib/errors');

async function list(req, res, next) {
  try {
    const places = await savedService.listSavedPlaces(req.user.id);
    return sendSuccess(res, places, 'Saved places retrieved', 200, { count: places.length });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, latitude, longitude, address, category } = req.body;
    const place = await savedService.createSavedPlace(req.user.id, {
      name,
      latitude,
      longitude,
      address,
      category
    });
    return sendSuccess(res, place, 'Place saved successfully', 201);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const place = await savedService.getSavedPlaceById(req.user.id, req.params.id);
    return sendSuccess(res, place, 'Saved place retrieved', 200);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const { name, latitude, longitude, address, category } = req.body;
    const updated = await savedService.updateSavedPlace(req.user.id, req.params.id, {
      name,
      latitude,
      longitude,
      address,
      category
    });
    return sendSuccess(res, updated, 'Saved place updated successfully', 200);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await savedService.deleteSavedPlace(req.user.id, req.params.id);
    return sendSuccess(res, result, 'Saved place deleted successfully', 200);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  getById,
  update,
  remove
};
