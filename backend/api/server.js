/**
 * TerraNav AI — Backend Server Entrypoint
 * Member 3: Backend Integration, Microservices & Data Layer
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const logger = require('./_lib/logging');
const { errorHandler, NotFoundError } = require('./_lib/errors');
const db = require('./_lib/db');
const apiRouter = require('./index');

const app = express();
const PORT = process.env.PORT || 5000;

// ------------------------------------------------------------------------------
// Middleware Configuration
// ------------------------------------------------------------------------------
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '2mb' }));
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

// Locate frontend static assets
const frontendPaths = [
  path.resolve(__dirname, '../../frontend'),
  path.resolve(__dirname, '../frontend'),
  path.resolve(__dirname, '../public')
];
const frontendDir = frontendPaths.find(p => fs.existsSync(p));

if (frontendDir) {
  app.use(express.static(frontendDir));
}

// ------------------------------------------------------------------------------
// Mount API Routes
// ------------------------------------------------------------------------------
app.use('/api', apiRouter);

// Root fallback to frontend UI
app.get('/', (req, res) => {
  if (frontendDir && fs.existsSync(path.join(frontendDir, 'index.html'))) {
    res.sendFile(path.join(frontendDir, 'index.html'));
  } else {
    res.json({
      service: 'terranav-backend',
      status: 'healthy',
      apiDocs: '/api/health'
    });
  }
});

// Catch-all 404 handler for undefined API routes
app.use('/api/*', (req, res, next) => {
  next(new NotFoundError(`API endpoint not found: ${req.method} ${req.originalUrl}`));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// ------------------------------------------------------------------------------
// Server Startup & Database Connection
// ------------------------------------------------------------------------------
async function startServer() {
  // Test MySQL connection
  const dbStatus = await db.testConnection();
  if (dbStatus.connected) {
    logger.info(`MySQL database connected: ${dbStatus.database} on ${dbStatus.host}`);
  } else {
    logger.warn(`Operating in ${dbStatus.mode} mode. XAMPP MySQL can be started anytime on port ${process.env.DB_PORT || 3306}.`);
  }

  const server = app.listen(PORT, () => {
    logger.info(`=======================================================`);
    logger.info(` TerraNav AI Backend Server Running on Port ${PORT} `);
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
