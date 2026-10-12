/**
 * TerraNav AI — Incidents Service
 * Member 3: Backend Integration & Microservices
 */

const db = require('../_lib/db');
const { BadRequestError, NotFoundError } = require('../_lib/errors');
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

  if (!targetChunk || typeof targetChunk !== 'string') {
    throw new BadRequestError('chunkId is required (e.g. "CHUNK_104")');
  }

  const cleanType = targetType ? String(targetType).toLowerCase().trim() : 'accident';
  if (!VALID_INCIDENT_TYPES.includes(cleanType)) {
    throw new BadRequestError(`Invalid incident type: '${targetType}'. Supported: ${VALID_INCIDENT_TYPES.join(', ')}`);
  }

  if (latitude !== undefined && longitude !== undefined && !isValidCoordinate(latitude, longitude)) {
    throw new BadRequestError(`Invalid coordinates for incident: lat=${latitude}, lng=${longitude}`);
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
      severity || 'medium',
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
    severity: severity || 'medium',
    status: status || 'active',
    reportedBy: reported_by,
    createdAt: new Date().toISOString()
  };
}

async function getIncidentById(incidentId) {
  const id = parseInt(incidentId, 10);
  if (isNaN(id)) {
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

async function updateIncidentStatus(incidentId, newStatus) {
  const id = parseInt(incidentId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid incident ID');
  }

  const validStatuses = ['active', 'cleared', 'expired'];
  if (!validStatuses.includes(newStatus)) {
    throw new BadRequestError(`Invalid status: '${newStatus}'. Supported: ${validStatuses.join(', ')}`);
  }

  await getIncidentById(id);

  await db.execute('UPDATE incidents SET status = ? WHERE id = ?', [newStatus, id]);

  return { id, status: newStatus };
}

async function deleteIncident(incidentId) {
  const id = parseInt(incidentId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid incident ID');
  }

  await getIncidentById(id);

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
