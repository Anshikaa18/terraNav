/**
 * ChunkFlow AI — Backend Server Entrypoint
 * Member 3: Backend Integration, Microservices & Data Layer
 */

const path = require('path');
// Backend secrets/config belong beside the backend, not in the frontend/root env.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');

const logger = require('./_lib/logging');
const { errorHandler, NotFoundError } = require('./_lib/errors');
const { assertProductionAuthConfig } = require('./_lib/auth');
const { securityHeaders } = require('./_lib/securityHeaders');
const db = require('./_lib/db');
const apiRouter = require('./index');

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------------------------------------------------------
// Middleware Configuration: Proxy Trust & CORS
// ------------------------------------------------------------------------------
const trustedProxy = process.env.TRUST_PROXY;
if (trustedProxy !== undefined) {
  const proxySetting = trustedProxy === 'true' ? true : (trustedProxy === 'false' ? false : trustedProxy);
  app.set('trust proxy', proxySetting);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 'loopback');
}

const rawCorsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000';
if (process.env.NODE_ENV === 'production' && (rawCorsOrigin === '*' || !rawCorsOrigin.trim())) {
  throw new Error('CORS_ORIGIN must be an explicit allowlist in production (not "*").');
}

const allowedOrigins = rawCorsOrigin === '*'
  ? '*'
  : rawCorsOrigin.split(',').map(o => o.trim()).filter(Boolean);

function corsOriginValidator(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }
  if (allowedOrigins === '*') {
    return callback(null, true);
  }
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  // Support wildcard patterns (e.g. https://*.vercel.app)
  const matchesPattern = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      const regex = new RegExp('^' + allowed.replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&').replace(/\\\*/g, '.*') + '$');
      return regex.test(origin);
    }
    return false;
  });
  if (matchesPattern) {
    return callback(null, true);
  }
  return callback(null, false);
}

app.use(cors({
  origin: corsOriginValidator,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(securityHeaders);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '2mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

const fs = require('fs');

// Locate compiled frontend production distribution or public assets
const frontendDistPaths = [
  path.resolve(__dirname, '../../frontend/dist'),
  path.resolve(__dirname, '../frontend/dist'),
  path.resolve(__dirname, '../dist'),
  path.resolve(__dirname, '../public')
];
const frontendDistDir = frontendDistPaths.find(p => fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html')));

if (frontendDistDir) {
  logger.info(`Serving compiled production frontend from: ${frontendDistDir}`);
  app.use(express.static(frontendDistDir));
}

// ------------------------------------------------------------------------------
// Mount API Routes
// ------------------------------------------------------------------------------
app.use('/api', apiRouter);

// Catch-all 404 handler for undefined API routes
app.use('/api/*', (req, res, next) => {
  next(new NotFoundError(`API endpoint not found: ${req.method} ${req.originalUrl}`));
});

// Client-side SPA routing fallback (survives direct navigation and refresh)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  if (frontendDistDir && fs.existsSync(path.join(frontendDistDir, 'index.html'))) {
    return res.sendFile(path.join(frontendDistDir, 'index.html'));
  }
  res.json({
    service: 'terranav-backend',
    status: 'healthy',
    apiDocs: '/api/health'
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// ------------------------------------------------------------------------------
// Server Startup & Database Connection
// ------------------------------------------------------------------------------
async function startServer() {
  assertProductionAuthConfig();

  const dbStatus = await db.testConnection();
  const isProduction = process.env.NODE_ENV === 'production';

  if (dbStatus.connected) {
    logger.info(`MySQL database connected: ${dbStatus.database} on ${dbStatus.host}`);
  } else if (isProduction) {
    logger.error(`Production startup blocked: MySQL unavailable (${dbStatus.mode}).`);
    process.exit(1);
  } else if (dbStatus.mode === 'unavailable') {
    logger.error('MySQL unavailable and ALLOW_IN_MEMORY_DB is not enabled. Set ALLOW_IN_MEMORY_DB=true only for local demos/tests.');
    process.exit(1);
  } else {
    logger.warn(`Operating in ${dbStatus.mode} mode. Start MySQL or set ALLOW_IN_MEMORY_DB=true for non-persistent demos.`);
  }

  const server = app.listen(PORT, () => {
    logger.info(`=======================================================`);
    logger.info(` ChunkFlow AI Backend Server Running on Port ${PORT} `);
    logger.info(` API Health: http://localhost:${PORT}/api/health       `);
    logger.info(` Testing UI: http://localhost:${PORT}/                 `);
    logger.info(`=======================================================`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
