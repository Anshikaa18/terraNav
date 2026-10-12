/**
 * TerraNav AI — Authentication Service
 * Member 3: Backend Integration & Microservices
 */

const bcrypt = require('bcryptjs');
const db = require('../_lib/db');
const { generateToken } = require('../_lib/auth');
const { BadRequestError, UnauthorizedError, ConflictError, NotFoundError } = require('../_lib/errors');
const { isValidEmail } = require('../_lib/validation');

/**
 * Register a new user
 */
async function register({ username, email, password }) {
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    throw new BadRequestError('Username must be at least 3 characters long');
  }
  if (!email || !isValidEmail(email)) {
    throw new BadRequestError('A valid email address is required');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new BadRequestError('Password must be at least 6 characters long');
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Check if username or email already exists
  const [existingUsers] = await db.execute(
    'SELECT id, username, email FROM users WHERE email = ?',
    [cleanEmail]
  );
  if (existingUsers && existingUsers.length > 0) {
    throw new ConflictError('A user with this email address already exists');
  }

  const [existingUsername] = await db.execute(
    'SELECT id, username FROM users WHERE username = ?',
    [cleanUsername]
  );
  if (existingUsername && existingUsername.length > 0) {
    throw new ConflictError('Username is already taken');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // Insert user
  const [result] = await db.execute(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [cleanUsername, cleanEmail, passwordHash]
  );

  const userId = result.insertId;
  const user = {
    id: userId,
    username: cleanUsername,
    email: cleanEmail
  };

  const token = generateToken(user);

  return {
    user,
    token
  };
}

/**
 * Authenticate existing user and return JWT
 */
async function login({ email, password }) {
  if (!email || !isValidEmail(email)) {
    throw new BadRequestError('A valid email address is required');
  }
  if (!password) {
    throw new BadRequestError('Password is required');
  }

  const cleanEmail = email.trim().toLowerCase();

  const [rows] = await db.execute(
    'SELECT id, username, email, password_hash, created_at FROM users WHERE email = ?',
    [cleanEmail]
  );

  if (!rows || rows.length === 0) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const userRecord = rows[0];
  const isMatch = await bcrypt.compare(password, userRecord.password_hash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const user = {
    id: userRecord.id,
    username: userRecord.username,
    email: userRecord.email,
    createdAt: userRecord.created_at
  };

  const token = generateToken(user);

  return {
    user,
    token
  };
}

/**
 * Get profile for authenticated user
 */
async function getProfile(userId) {
  const [rows] = await db.execute(
    'SELECT id, username, email, created_at FROM users WHERE id = ?',
    [userId]
  );

  if (!rows || rows.length === 0) {
    throw new NotFoundError('User profile not found');
  }

  return rows[0];
}

module.exports = {
  register,
  login,
  getProfile
};
