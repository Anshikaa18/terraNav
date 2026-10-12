/**
 * TerraNav AI — Saved Places Service
 * Member 3: Backend Integration & Microservices
 */

const db = require('../_lib/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../_lib/errors');
const { isValidCoordinate } = require('../_lib/validation');

async function listSavedPlaces(userId) {
  const [rows] = await db.execute(
    'SELECT id, user_id, name, latitude, longitude, address, category, created_at FROM saved_places WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows || [];
}

async function createSavedPlace(userId, { name, latitude, longitude, address, category }) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestError('Place name is required');
  }
  if (!isValidCoordinate(latitude, longitude)) {
    throw new BadRequestError(`Invalid coordinates: latitude=${latitude}, longitude=${longitude}`);
  }

  const cleanName = name.trim();
  const cleanAddress = address ? address.trim() : null;
  const cleanCategory = category ? category.trim() : 'favorite';

  const [result] = await db.execute(
    'INSERT INTO saved_places (user_id, name, latitude, longitude, address, category) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, cleanName, latitude, longitude, cleanAddress, cleanCategory]
  );

  return {
    id: result.insertId,
    userId,
    name: cleanName,
    latitude: Number(latitude),
    longitude: Number(longitude),
    address: cleanAddress,
    category: cleanCategory,
    createdAt: new Date().toISOString()
  };
}

async function getSavedPlaceById(userId, placeId) {
  const id = parseInt(placeId, 10);
  if (isNaN(id)) {
    throw new BadRequestError('Invalid place ID');
  }

  const [rows] = await db.execute(
    'SELECT id, user_id, name, latitude, longitude, address, category, created_at FROM saved_places WHERE user_id = ? AND id = ?',
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
  createSavedPlace,
  getSavedPlaceById,
  updateSavedPlace,
  deleteSavedPlace
};
