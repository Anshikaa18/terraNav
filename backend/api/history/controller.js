/**
 * TerraNav AI — Route History Controller
 * Member 3: Backend Integration & Microservices
 */

const historyService = require('./service');
const { sendSuccess } = require('../_lib/errors');

async function list(req, res, next) {
  try {
    const limit = req.query.limit || 20;
    const items = await historyService.listRouteHistory(req.user.id, limit);
    return sendSuccess(res, items, 'Route history retrieved', 200, { count: items.length });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = req.body;
    const history = await historyService.logRouteHistory(req.user.id, data);
    return sendSuccess(res, history, 'Route history logged successfully', 201);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const item = await historyService.getRouteHistoryById(req.user.id, req.params.id);
    return sendSuccess(res, item, 'Route history detail retrieved', 200);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await historyService.deleteRouteHistory(req.user.id, req.params.id);
    return sendSuccess(res, result, 'Route history deleted successfully', 200);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  getById,
  remove
};
