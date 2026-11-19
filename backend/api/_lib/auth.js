/**
 * ChunkFlow AI — JWT Authentication Middleware & Token Service
 * Member 3: Backend Integration & Microservices
 */

const jwt = require('jsonwebtoken');
const { UnauthorizedError } = require('./errors');
const logger = require('./logging');

const KNOWN_WEAK_SECRETS = new Set([
  'terranav_default_secret_key_change_me_2026',
  'terranav_ai_jwt_super_secret_key_2026_production_change_me',
  'replace_with_a_secure_random_at_least_32_char_secret_key',
  'secret',
  'jwt_secret',
  'changeme'
]);

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';

  if (isProduction) {
    if (!secret || secret.length < 32 || KNOWN_WEAK_SECRETS.has(secret)) {
      throw new Error(
        'JWT_SECRET must be set to a strong unique value (>= 32 characters) in production.'
      );
    }
    return secret;
  }

  if (secret) {
    if (KNOWN_WEAK_SECRETS.has(secret)) {
      if (nodeEnv !== 'test') {
        throw new Error(
          'JWT_SECRET uses a known weak placeholder secret. Generate a strong unique secret (>= 32 characters) in your .env file.'
        );
      }
      logger.warn('JWT_SECRET uses a known placeholder value; replace it before production deployment.');
    }
    if (secret.length < 32 && nodeEnv !== 'test') {
      throw new Error('JWT_SECRET must be at least 32 characters long.');
    }
    return secret;
  }

  if (nodeEnv === 'test') {
    return 'terranav-test-jwt-secret-32chars-min';
  }

  throw new Error(
    'JWT_SECRET is required. Copy backend/.env.example to backend/.env and set a strong secret.'
  );
}

function assertProductionAuthConfig() {
  resolveJwtSecret();
}

const JWT_SECRET = resolveJwtSecret();
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
 * Allows no Authorization header, but rejects malformed or invalid bearer tokens.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    req.user = null;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return next(new UnauthorizedError('Invalid Authorization format. Expected "Authorization: Bearer <token>"'));
  }

  try {
    req.user = verifyToken(parts[1]);
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  optionalAuth,
  assertProductionAuthConfig,
  resolveJwtSecret,
  JWT_SECRET,
  JWT_EXPIRES_IN
};
