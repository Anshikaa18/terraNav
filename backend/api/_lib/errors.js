/**
 * TerraNav AI — Centralized Error Handling & Response Envelope
 * Member 3: Backend Integration & Microservices
 */

const logger = require('./logging');

class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400, details);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', details = null) {
    super(message, 401, details);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden access to resource', details = null) {
    super(message, 403, details);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details = null) {
    super(message, 404, details);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, details);
  }
}

class BadGatewayError extends AppError {
  constructor(message = 'Upstream service error', details = null) {
    super(message, 502, details);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', details = null) {
    super(message, 503, details);
  }
}

/**
 * Standard JSON Success Response Helper
 */
function sendSuccess(res, data = null, message = 'Success', statusCode = 200, meta = null) {
  const response = {
    success: true,
    message,
    data
  };
  if (meta) {
    response.meta = meta;
  }
  return res.status(statusCode).json(response);
}

/**
 * Central Express Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error with context
  logger.error(`Error on [${req.method}] ${req.originalUrl}: ${message}`, {
    statusCode,
    details: err.details,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });

  const response = {
    success: false,
    error: {
      message,
      statusCode
    }
  };

  if (err.details) {
    response.error.details = err.details;
  }

  // Never leak internal stack trace in production
  if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
    response.error.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BadGatewayError,
  ServiceUnavailableError,
  sendSuccess,
  errorHandler
};
