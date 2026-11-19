/**
 * Lightweight in-memory rate limiter (fixed window per client key).
 * Uses Express-managed req.ip, which honors app.get('trust proxy') settings.
 */

const buckets = new Map();

function clientKey(req) {
  if (req.ip) {
    return req.ip;
  }
  return req.socket?.remoteAddress || 'unknown';
}

function resetAllBuckets() {
  buckets.clear();
}

function createRateLimiter({ windowMs = 60_000, max = 60, name = 'default' } = {}) {
  return (req, res, next) => {
    const key = `${name}:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      const err = new Error('Too many requests. Please try again later.');
      err.statusCode = 429;
      return next(err);
    }
    return next();
  };
}

module.exports = { createRateLimiter, clientKey, resetAllBuckets };
