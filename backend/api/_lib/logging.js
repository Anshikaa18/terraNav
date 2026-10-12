/**
 * TerraNav AI — Structured Logging Utility
 * Member 3: Backend Integration & Microservices
 */

const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

function formatLog(level, message, meta = null) {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

const logger = {
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatLog(LOG_LEVELS.DEBUG, message, meta));
    }
  },
  info: (message, meta) => {
    console.log(formatLog(LOG_LEVELS.INFO, message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatLog(LOG_LEVELS.WARN, message, meta));
  },
  error: (message, meta) => {
    console.error(formatLog(LOG_LEVELS.ERROR, message, meta));
  }
};

module.exports = logger;
