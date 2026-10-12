/**
 * TerraNav AI — Incidents Controller
 * Member 3: Backend Integration & Microservices
 */

const incidentService = require('./service');
const { sendSuccess } = require('../_lib/errors');

async function list(req, res, next) {
  try {
    const status = req.query.status || 'active';
    const incidents = await incidentService.listIncidents(status);
    return sendSuccess(res, incidents, 'Incidents retrieved', 200, { count: incidents.length });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = req.body;
    const reportedBy = req.user ? req.user.id : null;
    const incident = await incidentService.createIncident({ ...data, reported_by: reportedBy });
    return sendSuccess(res, incident, 'Incident reported successfully', 201);
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    return sendSuccess(res, incident, 'Incident retrieved', 200);
  } catch (err) {
    return next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const result = await incidentService.updateIncidentStatus(req.params.id, status);
    return sendSuccess(res, result, 'Incident status updated', 200);
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await incidentService.deleteIncident(req.params.id);
    return sendSuccess(res, result, 'Incident deleted successfully', 200);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  list,
  create,
  getById,
  updateStatus,
  remove
};
