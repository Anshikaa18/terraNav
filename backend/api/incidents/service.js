/**
 * ChunkFlow AI — Incidents Service
 * Member 3: Backend Integration & Microservices
 */

const db = require('../_lib/db');
const { BadRequestError, NotFoundError, ForbiddenError, UnauthorizedError } = require('../_lib/errors');
const { VALID_INCIDENT_TYPES, isValidCoordinate } = require('../_lib/validation');

async function listIncidents(status = 'active') {
  let sql = 'SELECT * FROM incidents';
  const params = [];

  if (status && status !== 'all') {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';

  const [rows] = await db.execute(sql, params);
  return rows || [];
}

async function createIncident({ chunkId, chunk_id, type, incident_type, latitude, longitude, description, severity, status = 'active', reported_by = null }) {
  const targetChunk = chunkId || chunk_id;
  const targetType = type || incident_type;

  if (!reported_by) {
    throw new UnauthorizedError('Authentication required to report an incident');
  }

  if (!targetChunk || typeof targetChunk !== 'string' || targetChunk.trim().length === 0 || targetChunk.trim().length > 50) {
    throw new BadRequestError('chunkId is required (1-50 characters, e.g. "CHUNK_104")');
  }

  const cleanType = targetType ? String(targetType).toLowerCase().trim() : 'accident';
  if (!VALID_INCIDENT_TYPES.includes(cleanType)) {
    throw new BadRequestError(`Invalid incident type: '${targetType}'. Supported: ${VALID_INCIDENT_TYPES.join(', ')}`);
  }

  if (latitude !== undefined && longitude !== undefined && !isValidCoordinate(latitude, longitude)) {
    throw new BadRequestError(`Invalid coordinates for incident: lat=${latitude}, lng=${longitude}`);
  }

  if (description && String(description).length > 500) {
    throw new BadRequestError('Incident description must be 500 characters or fewer');
  }

  const cleanSeverity = severity ? String(severity).toLowerCase().trim() : 'medium';
  const validSeverities = ['low', 'medium', 'high', 'critical'];
  if (!validSeverities.includes(cleanSeverity)) {
    throw new BadRequestError(`Invalid severity: '${severity}'. Supported: ${validSeverities.join(', ')}`);
  }

  const [result] = await db.execute(
    `INSERT INTO incidents (chunk_id, incident_type, latitude, longitude, description, severity, status, reported_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      targetChunk.trim().toUpperCase(),
      cleanType,
      latitude !== undefined ? latitude : null,
      longitude !== undefined ? longitude : null,
      description ? description.trim() : null,
      cleanSeverity,
      status || 'active',
      reported_by || null
    ]
  );

  return {
    id: result.insertId,
    chunkId: targetChunk.trim().toUpperCase(),
    incidentType: cleanType,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    description: description || null,
    severity: cleanSeverity,
    status: status || 'active',
    reportedBy: reported_by,
    createdAt: new Date().toISOString()
  };
}

async function getIncidentById(incidentId) {
  const id = parseInt(incidentId, 10);
  if (isNaN(id) || id <= 0) {
    throw new BadRequestError('Invalid incident ID');
  }

  const [rows] = await db.execute('SELECT * FROM incidents WHERE id = ?', [id]);
  if (!rows || rows.length === 0) {
    throw new NotFoundError(`Incident with ID ${id} not found`);
  }
  return rows[0];
}

async function getActiveIncidentForChunk(chunkId) {
  if (!chunkId) return null;
  const [rows] = await db.execute(
    'SELECT * FROM incidents WHERE chunk_id = ? AND status = ?',
    [chunkId.trim().toUpperCase(), 'active']
  );
  return rows && rows.length > 0 ? rows[0] : null;
}

async function updateIncidentStatus(incidentId, newStatus, requestingUser) {
  const id = parseInt(incidentId, 10);
  if (isNaN(id) || id <= 0) {
    throw new BadRequestError('Invalid incident ID');
  }

  const validStatuses = ['active', 'cleared', 'expired'];
  if (!validStatuses.includes(newStatus)) {
    throw new BadRequestError(`Invalid status: '${newStatus}'. Supported: ${validStatuses.join(', ')}`);
  }

  const incident = await getIncidentById(id);

  if (!requestingUser || !requestingUser.id) {
    throw new UnauthorizedError('Authentication required to modify an incident');
  }

  const isOwner = incident.reported_by !== null && Number(incident.reported_by) === Number(requestingUser.id);
  const isAdmin = requestingUser.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to modify this incident');
  }

  await db.execute('UPDATE incidents SET status = ? WHERE id = ?', [newStatus, id]);

  return { id, status: newStatus };
}

async function deleteIncident(incidentId, requestingUser) {
  const id = parseInt(incidentId, 10);
  if (isNaN(id) || id <= 0) {
    throw new BadRequestError('Invalid incident ID');
  }

  const incident = await getIncidentById(id);

  if (!requestingUser || !requestingUser.id) {
    throw new UnauthorizedError('Authentication required to delete an incident');
  }

  const isOwner = incident.reported_by !== null && Number(incident.reported_by) === Number(requestingUser.id);
  const isAdmin = requestingUser.role === 'admin';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to delete this incident');
  }

  await db.execute('DELETE FROM incidents WHERE id = ?', [id]);

  return { deleted: true, id };
}

module.exports = {
  listIncidents,
  createIncident,
  getIncidentById,
  getActiveIncidentForChunk,
  updateIncidentStatus,
  deleteIncident
};
