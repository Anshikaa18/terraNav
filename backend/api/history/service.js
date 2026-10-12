/**
 * TerraNav AI — Route History Service
 * Member 3: Backend Integration & Microservices
 */

const db = require('../_lib/db');
const { BadRequestError, NotFoundError } = require('../_lib/errors');
const { isValidCoordinate } = require('../_lib/validation');

async function listRouteHistory(userId, limit = 20) {
  const [rows] = await db.execute(
    'SELECT id, user_id, origin_lat, origin_lng, origin_name, dest_lat, dest_lng, dest_name, transport_mode, total_distance_meters, total_duration_seconds, traditional_duration_seconds, time_saved_seconds, simulated_incident, created_at FROM route_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [userId, Number(limit)]
  );
  return rows || [];
}

async function logRouteHistory(userId, {
  origin_lat,
  origin_lng,
  origin_name,
  dest_lat,
  dest_lng,
  dest_name,
  transport_mode = 'car',
  total_distance_meters,
  total_duration_seconds,
  traditional_duration_seconds,
  time_saved_seconds = 0,
  simulated_incident = null
}) {
  if (!isValidCoordinate(origin_lat, origin_lng)) {
    throw new BadRequestError('Invalid origin coordinates');
  }
  if (!isValidCoordinate(dest_lat, dest_lng)) {
    throw new BadRequestError('Invalid destination coordinates');
  }

  const incidentPayload = simulated_incident ? JSON.stringify(simulated_incident) : null;

  const [result] = await db.execute(
    `INSERT INTO route_history 
     (user_id, origin_lat, origin_lng, origin_name, dest_lat, dest_lng, dest_name, transport_mode, total_distance_meters, total_duration_seconds, traditional_duration_seconds, time_saved_seconds, simulated_incident)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      origin_lat,
      origin_lng,
      origin_name || null,
      dest_lat,
      dest_lng,
      dest_name || null,
      transport_mode,
      Math.round(total_distance_meters || 0),
      Math.round(total_duration_seconds || 0),
      Math.round(traditional_duration_seconds || 0),
      Math.round(time_saved_seconds || 0),
      incidentPayload
    ]
  );

  return {
    id: result.insertId,
    userId,
    origin: { lat: Number(origin_lat), lng: Number(origin_lng), name: origin_name },
    destination: { lat: Number(dest_lat), lng: Number(dest_lng), name: dest_name },
    transportMode: transport_mode,
    totalDistanceMeters: total_distance_meters,
    totalDurationSeconds: total_duration_seconds,
    traditionalDurationSeconds: traditional_duration_seconds,
    timeSavedSeconds: time_saved_seconds,
    simulatedIncident: simulated_incident,
    createdAt: new Date().toISOString()
  };
}

async function getRouteHistoryById(userId, historyId) {
  const id = parseInt(historyId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid route history ID');
  }

  const [rows] = await db.execute(
    'SELECT * FROM route_history WHERE user_id = ? AND id = ?',
    [userId, id]
  );

  if (!rows || rows.length === 0) {
    throw new NotFoundError(`Route history item with ID ${id} not found`);
  }

  return rows[0];
}

async function deleteRouteHistory(userId, historyId) {
  const id = parseInt(historyId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid route history ID');
  }

  await getRouteHistoryById(userId, id);

  await db.execute(
    'DELETE FROM route_history WHERE user_id = ? AND id = ?',
    [userId, id]
  );

  return { deleted: true, id };
}

module.exports = {
  listRouteHistory,
  logRouteHistory,
  getRouteHistoryById,
  deleteRouteHistory
};
