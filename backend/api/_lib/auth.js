/**
 * TerraNav AI — JWT Authentication Middleware & Token Service
 * Member 3: Backend Integration & Microservices
 */

const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('./errors');
const logger = require('./logging');

const JWT_SECRET = process.env.JWT_SECRET || 'terranav_default_secret_key_change_me_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate signed JWT for authenticated user
 */
function generateToken(payload) {
  const tokenPayload = {
    id: payload.id,
    username: payload.username,
    email: payload.email
  };
  return jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verify JWT token string
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Authentication token has expired. Please log in again.');
    }
    throw new UnauthorizedError('Invalid authentication token');
  }
}

/**
 * Express Middleware: Require valid Bearer token
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new UnauthorizedError('Authorization header missing. Expected "Authorization: Bearer <token>"'));
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(new UnauthorizedError('Invalid Authorization format. Expected "Bearer <token>"'));
  }

  const token = parts[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Express Middleware: Optional authentication
 * Does not reject unauthenticated requests, but attaches req.user if token is valid.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    try {
      const decoded = verifyToken(parts[1]);
      req.user = decoded;
    } catch (err) {
      // Ignore invalid token for optional auth, leave req.user = null
      req.user = null;
    }
  } else {
    req.user = null;
  }
  return next();
}

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
