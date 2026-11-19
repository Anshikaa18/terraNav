/**
 * ChunkFlow AI — Saved Places Service
 * Member 3: Backend Integration & Microservices
 */

const db = require('../_lib/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../_lib/errors');
const { isValidCoordinate } = require('../_lib/validation');

function normalizeAddress(address) {
  if (typeof address === 'string') return address.trim() || null;
  if (!address || typeof address !== 'object' || Array.isArray(address)) return null;
  const displayName = typeof address.display_name === 'string' ? address.display_name.trim() : '';
  if (displayName) return displayName;
  const parts = Object.values(address).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim());
  return parts.length ? parts.join(', ') : null;
}

async function listSavedPlaces(userId) {
  const [rows] = await db.execute(
    'SELECT id, user_id, name, latitude, longitude, address, category, collection_name, notes, created_at FROM saved_places WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows || [];
}

async function createSavedPlace(userId, { name, latitude, longitude, address, category, collectionName, notes }) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('Place name is required');
  }
  if (!isValidCoordinate(latitude, longitude)) {
    throw new BadRequestError(`Invalid coordinates: latitude=${latitude}, longitude=${longitude}`);
  }

  const cleanName = name.trim();
  const cleanAddress = normalizeAddress(address);
  const cleanCategory = typeof category === 'string' && category.trim() ? category.trim() : 'place';
  const cleanCollectionName = typeof collectionName === 'string' && collectionName.trim() ? collectionName.trim() : 'Favorites';
  const cleanNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null;

  const [result] = await db.execute(
    'INSERT INTO saved_places (user_id, name, latitude, longitude, address, category, collection_name, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, cleanName, latitude, longitude, cleanAddress, cleanCategory, cleanCollectionName, cleanNotes]
  );

  return {
    id: result.insertId,
    userId,
    name: cleanName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    address: cleanAddress,
    category: cleanCategory,
    collectionName: cleanCollectionName,
    notes: cleanNotes,
    createdAt: new Date().toISOString()
  };
}

async function getSavedPlaceById(userId, placeId) {
  const id = parseInt(placeId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid place ID');
  }

  const [rows] = await db.execute(
    'SELECT id, user_id, name, latitude, longitude, address, category, collection_name, notes, created_at FROM saved_places WHERE user_id = ? AND id = ?',
    [userId, id]
  );

  if (!rows || rows.length === 0) {
    throw new NotFoundError(`Saved place with ID ${id} not found`);
  }

  return rows[0];
}

async function updateSavedPlace(userId, placeId, { name, latitude, longitude, address, category }) {
  const id = parseInt(placeId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid place ID');
  }

  // Ensure place exists and belongs to user
  const existing = await getSavedPlaceById(userId, id);

  const updatedName = name !== undefined ? name.trim() : existing.name;
  const updatedLat = latitude !== undefined ? latitude : existing.latitude;
  const updatedLng = longitude !== undefined ? longitude : existing.longitude;
  const updatedAddress = address !== undefined ? address : existing.address;
  const updatedCategory = category !== undefined ? category : existing.category;

  if (!isValidCoordinate(updatedLat, updatedLng)) {
    throw new BadRequestError(`Invalid coordinates: latitude=${updatedLat}, longitude=${updatedLng}`);
  }

  await db.execute(
    'UPDATE saved_places SET name = ?, latitude = ?, longitude = ?, address = ?, category = ? WHERE user_id = ? AND id = ?',
    [updatedName, updatedLat, updatedLng, updatedAddress, updatedCategory, userId, id]
  );

  return {
    id,
    userId,
    name: updatedName,
    latitude: Number(updatedLat),
    longitude: Number(updatedLng),
    address: updatedAddress,
    category: updatedCategory
  };
}

async function deleteSavedPlace(userId, placeId) {
  const id = parseInt(placeId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid place ID');
  }

  // Ensure place exists
  await getSavedPlaceById(userId, id);

  await db.execute(
    'DELETE FROM saved_places WHERE user_id = ? AND id = ?',
    [userId, id]
  );

  return { deleted: true, id };
}

module.exports = {
  listSavedPlaces,
  normalizeAddress,
  createSavedPlace,
  getSavedPlaceById,
  updateSavedPlace,
  deleteSavedPlace
};
