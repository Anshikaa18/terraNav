/**
 * TerraNav AI — Database Layer (MySQL Pool + In-Memory Fallback Adapter)
 * Member 3: Backend Integration & Microservices
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const logger = require('./logging');

let pool = null;
let isConnectedToMySQL = false;
let connectionAttempted = false;
const allowInMemoryFallback = process.env.ALLOW_IN_MEMORY_DB === 'true';
const useInMemoryOnly =
  allowInMemoryFallback &&
  (process.env.NODE_ENV === 'test' || process.env.FORCE_IN_MEMORY_DB === 'true');

function shouldUseMySQL() {
  return !useInMemoryOnly;
}

// In-Memory Database Fallback Store (Used when XAMPP MySQL is temporarily offline)
const inMemoryStore = {
  users: [
    {
      id: 1,
      username: 'demo_user',
      email: 'demo@terranav.app',
      password_hash: '$2a$10$tWOXLQIAn/TKnjnvNJtstewcsT5tCbTHqvue5MLC6KggT0/..4A2m', // password123
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  saved_places: [
    {
      id: 1,
      user_id: 1,
      name: 'Central Station Hub',
      latitude: 12.9784,
      longitude: 77.5726,
      address: 'Kempegowda, Bengaluru',
      category: 'favorite',
      collection_name: 'Favorites',
      notes: null,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      user_id: 1,
      name: 'MG Road Metro Station',
      latitude: 12.9756,
      longitude: 77.6066,
      address: 'MG Road, Bengaluru',
      category: 'work',
      collection_name: 'Work & Transit',
      notes: null,
      created_at: new Date().toISOString()
    }
  ],
  route_history: [],
  incidents: [],
  autoIncrements: {
    users: 2,
    saved_places: 3,
    route_history: 1,
    incidents: 1
  }
};

/**
 * Initialize MySQL Connection Pool
 */
function createPool() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'terranav_db',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    queueLimit: 0,
    connectTimeout: 5000
  };

  const useSSL = process.env.DB_SSL === 'true' ||
    (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com'));

  if (useSSL) {
    let caCertificate = null;
    if (process.env.DB_CA_CERT) {
      caCertificate = process.env.DB_CA_CERT;
    } else if (process.env.DB_CA_PATH && fs.existsSync(process.env.DB_CA_PATH)) {
      caCertificate = fs.readFileSync(process.env.DB_CA_PATH, 'utf8');
    } else {
      const defaultCaPath = path.resolve(__dirname, '../../aiven-ca.pem');
      if (fs.existsSync(defaultCaPath)) {
        caCertificate = fs.readFileSync(defaultCaPath, 'utf8');
      }
    }

    if (caCertificate) {
      config.ssl = {
        ca: caCertificate,
        rejectUnauthorized: true
      };
      logger.info('MySQL SSL enabled with strict CA certificate verification');
    } else {
      config.ssl = {
        rejectUnauthorized: process.env.DB_REJECT_UNAUTHORIZED === 'true'
      };
      logger.warn('MySQL SSL enabled (no custom CA certificate found)');
    }
  }

  try {
    pool = mysql.createPool(config);
    return pool;
  } catch (err) {
    logger.warn(`Failed to initialize MySQL pool: ${err.message}.`);
    return null;
  }
}

let reconnectTimer = null;

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    try {
      if (!pool) createPool();
      if (pool) {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        isConnectedToMySQL = true;
        logger.info('MySQL reconnected successfully in background.');
      }
    } catch {
      scheduleReconnect();
    }
  }, 10000);
}

/**
 * Test Connection to MySQL with fast timeout
 */
async function testConnection() {
  connectionAttempted = true;

  if (useInMemoryOnly) {
    isConnectedToMySQL = false;
    return {
      connected: false,
      mode: 'in-memory-test-fallback',
      message: 'Deterministic in-memory database (ALLOW_IN_MEMORY_DB=true for tests).'
    };
  }

  if (!pool) {
    createPool();
  }

  if (!pool) {
    isConnectedToMySQL = false;
    if (allowInMemoryFallback) {
      scheduleReconnect();
      return {
        connected: false,
        mode: 'in-memory-fallback',
        message: 'MySQL pool could not be initialized. Using in-memory store.'
      };
    }
    return {
      connected: false,
      mode: 'unavailable',
      message: 'MySQL is unavailable and in-memory fallback is disabled.'
    };
  }

  try {
    const probePromise = (async () => {
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      return true;
    })();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection probe timed out')), 1000)
    );

    await Promise.race([probePromise, timeoutPromise]);
    isConnectedToMySQL = true;
    logger.info(`Successfully connected to MySQL at ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || '3306'} (DB: ${process.env.DB_NAME || 'terranav_db'})`);
    return {
      connected: true,
      mode: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      database: process.env.DB_NAME || 'terranav_db'
    };
  } catch (err) {
    isConnectedToMySQL = false;
    scheduleReconnect();
    logger.warn(`MySQL connection test failed (${err.code || err.message}).`);
    if (allowInMemoryFallback) {
      logger.warn('Using in-memory database store (ALLOW_IN_MEMORY_DB=true).');
      return {
        connected: false,
        mode: 'in-memory-fallback',
        error: err.code || err.message
      };
    }
    return {
      connected: false,
      mode: 'unavailable',
      error: err.code || err.message
    };
  }
}

/**
 * Fallback query processor for simple CRUD operations when MySQL is offline
 */
function executeFallback(sql, params = []) {
  const normalized = sql.trim().toUpperCase();

  // INSERT INTO users
  if (normalized.startsWith('INSERT INTO USERS')) {
    const id = inMemoryStore.autoIncrements.users++;
    const [username, email, password_hash] = params;
    // Check duplicate
    if (inMemoryStore.users.some(u => u.email === email || u.username === username)) {
      const err = new Error('Duplicate entry');
      err.code = 'ER_DUP_ENTRY';
      throw err;
    }
    const user = {
      id,
      username,
      email,
      password_hash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    inMemoryStore.users.push(user);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  // SELECT ... FROM users
  if (normalized.startsWith('SELECT') && normalized.includes('FROM USERS')) {
    if (normalized.includes('WHERE EMAIL = ?')) {
      const email = params[0];
      const match = inMemoryStore.users.filter(u => u.email === email);
      return [match, []];
    }
    if (normalized.includes('WHERE USERNAME = ?')) {
      const username = params[0];
      const match = inMemoryStore.users.filter(u => u.username === username);
      return [match, []];
    }
    if (normalized.includes('WHERE ID = ?')) {
      const id = parseInt(params[0], 10);
      const match = inMemoryStore.users.filter(u => u.id === id);
      return [match, []];
    }
    return [inMemoryStore.users, []];
  }

  // INSERT INTO saved_places
  if (normalized.startsWith('INSERT INTO SAVED_PLACES')) {
    const id = inMemoryStore.autoIncrements.saved_places++;
    const [user_id, name, latitude, longitude, address, category, collection_name, notes] = params;
    const place = {
      id,
      user_id: parseInt(user_id, 10),
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || null,
      category: category || 'favorite',
      collection_name: collection_name || 'Favorites',
      notes: notes || null,
      created_at: new Date().toISOString()
    };
    inMemoryStore.saved_places.push(place);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  // SELECT ... FROM saved_places
  if (normalized.startsWith('SELECT') && normalized.includes('FROM SAVED_PLACES')) {
    if (normalized.includes('WHERE USER_ID = ? AND ID = ?')) {
      const [userId, id] = params;
      const match = inMemoryStore.saved_places.filter(p => p.user_id === parseInt(userId, 10) && p.id === parseInt(id, 10));
      return [match, []];
    }
    if (normalized.includes('WHERE USER_ID = ?')) {
      const userId = parseInt(params[0], 10);
      const match = inMemoryStore.saved_places.filter(p => p.user_id === userId);
      return [match, []];
    }
    if (normalized.includes('WHERE ID = ?')) {
      const id = parseInt(params[0], 10);
      const match = inMemoryStore.saved_places.filter(p => p.id === id);
      return [match, []];
    }
    return [inMemoryStore.saved_places, []];
  }

  // UPDATE saved_places
  if (normalized.startsWith('UPDATE SAVED_PLACES')) {
    const [name, latitude, longitude, address, category, userId, id] = params;
    const place = inMemoryStore.saved_places.find(p => p.user_id === parseInt(userId, 10) && p.id === parseInt(id, 10));
    if (place) {
      place.name = name;
      place.latitude = parseFloat(latitude);
      place.longitude = parseFloat(longitude);
      place.address = address;
      place.category = category;
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // DELETE FROM saved_places
  if (normalized.startsWith('DELETE FROM SAVED_PLACES')) {
    const [userId, id] = params;
    const index = inMemoryStore.saved_places.findIndex(p => p.user_id === parseInt(userId, 10) && p.id === parseInt(id, 10));
    if (index !== -1) {
      inMemoryStore.saved_places.splice(index, 1);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // INSERT INTO route_history
  if (normalized.startsWith('INSERT INTO ROUTE_HISTORY')) {
    const id = inMemoryStore.autoIncrements.route_history++;
    const [
      user_id,
      origin_lat,
      origin_lng,
      origin_name,
      dest_lat,
      dest_lng,
      dest_name,
      transport_mode,
      total_distance_meters,
      total_duration_seconds,
      traditional_duration_seconds,
      time_saved_seconds,
      simulated_incident
    ] = params;
    const history = {
      id,
      user_id: parseInt(user_id, 10),
      origin_lat: parseFloat(origin_lat),
      origin_lng: parseFloat(origin_lng),
      origin_name: origin_name || null,
      dest_lat: parseFloat(dest_lat),
      dest_lng: parseFloat(dest_lng),
      dest_name: dest_name || null,
      transport_mode: transport_mode || 'car',
      total_distance_meters: parseInt(total_distance_meters, 10),
      total_duration_seconds: parseInt(total_duration_seconds, 10),
      traditional_duration_seconds: parseInt(traditional_duration_seconds, 10),
      time_saved_seconds: parseInt(time_saved_seconds, 10),
      simulated_incident: typeof simulated_incident === 'string' ? JSON.parse(simulated_incident) : simulated_incident,
      created_at: new Date().toISOString()
    };
    inMemoryStore.route_history.push(history);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  // SELECT ... FROM route_history
  if (normalized.startsWith('SELECT') && normalized.includes('FROM ROUTE_HISTORY')) {
    if (normalized.includes('WHERE USER_ID = ? AND ID = ?')) {
      const [userId, id] = params;
      const match = inMemoryStore.route_history.filter(h => h.user_id === parseInt(userId, 10) && h.id === parseInt(id, 10));
      return [match, []];
    }
    if (normalized.includes('WHERE USER_ID = ?')) {
      const userId = parseInt(params[0], 10);
      let match = inMemoryStore.route_history.filter(h => h.user_id === userId);
      if (normalized.includes('ORDER BY')) {
        match = match.slice().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
      if (normalized.includes('LIMIT')) {
        const limit = parseInt(params[params.length - 1], 10);
        if (Number.isFinite(limit) && limit >= 0) {
          match = match.slice(0, limit);
        }
      }
      return [match, []];
    }
    return [inMemoryStore.route_history, []];
  }

  // DELETE FROM route_history
  if (normalized.startsWith('DELETE FROM ROUTE_HISTORY')) {
    const [userId, id] = params;
    if (!normalized.includes('AND ID = ?')) {
      const before = inMemoryStore.route_history.length;
      inMemoryStore.route_history = inMemoryStore.route_history.filter(h => h.user_id !== parseInt(userId, 10));
      return [{ affectedRows: before - inMemoryStore.route_history.length }, []];
    }
    const index = inMemoryStore.route_history.findIndex(h => h.user_id === parseInt(userId, 10) && h.id === parseInt(id, 10));
    if (index !== -1) {
      inMemoryStore.route_history.splice(index, 1);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // INSERT INTO incidents
  if (normalized.startsWith('INSERT INTO INCIDENTS')) {
    const id = inMemoryStore.autoIncrements.incidents++;
    const [chunk_id, incident_type, latitude, longitude, description, severity, status, reported_by] = params;
    const incident = {
      id,
      chunk_id,
      incident_type,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      description: description || null,
      severity: severity || 'medium',
      status: status || 'active',
      reported_by: reported_by ? parseInt(reported_by, 10) : null,
      created_at: new Date().toISOString()
    };
    inMemoryStore.incidents.push(incident);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  // SELECT ... FROM incidents
  if (normalized.startsWith('SELECT') && normalized.includes('FROM INCIDENTS')) {
    if (normalized.includes('WHERE CHUNK_ID = ? AND STATUS = ?')) {
      const [chunkId, status] = params;
      const match = inMemoryStore.incidents.filter(i => i.chunk_id === chunkId && i.status === status);
      return [match, []];
    }
    if (normalized.includes('WHERE STATUS = ?')) {
      const status = params[0];
      const match = inMemoryStore.incidents.filter(i => i.status === status);
      return [match, []];
    }
    if (normalized.includes('WHERE ID = ?')) {
      const id = parseInt(params[0], 10);
      const match = inMemoryStore.incidents.filter(i => i.id === id);
      return [match, []];
    }
    return [inMemoryStore.incidents, []];
  }

  // UPDATE incidents
  if (normalized.startsWith('UPDATE INCIDENTS')) {
    if (normalized.includes('SET STATUS = ?')) {
      const [status, id] = params;
      const incident = inMemoryStore.incidents.find(i => i.id === parseInt(id, 10));
      if (incident) {
        incident.status = status;
        if (status === 'cleared') incident.cleared_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      return [{ affectedRows: 0 }, []];
    }
  }

  // DELETE FROM incidents
  if (normalized.startsWith('DELETE FROM INCIDENTS')) {
    const id = parseInt(params[0], 10);
    const index = inMemoryStore.incidents.findIndex(i => i.id === id);
    if (index !== -1) {
      inMemoryStore.incidents.splice(index, 1);
      return [{ affectedRows: 1 }, []];
    }
    return [{ affectedRows: 0 }, []];
  }

  // Generic fallback: return empty array
  return [[], []];
}

/**
 * Execute parameterized query with connection pooling or fallback
 */
async function query(sql, params = []) {
  if (shouldUseMySQL() && isConnectedToMySQL && pool) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      logger.error(`MySQL query error: ${err.message}`, { sql, params });
      throw err;
    }
  }

  if (allowInMemoryFallback) return executeFallback(sql, params);
  const error = new Error('MySQL is unavailable. Start XAMPP MySQL and configure terranav_db.');
  error.code = 'DB_UNAVAILABLE';
  throw error;
}

/**
 * Execute prepared statement
 */
async function execute(sql, params = []) {
  if (shouldUseMySQL() && isConnectedToMySQL && pool) {
    try {
      return await pool.execute(sql, params);
    } catch (err) {
      logger.error(`MySQL execute error: ${err.message}`, { sql, params });
      throw err;
    }
  }

  if (allowInMemoryFallback) return executeFallback(sql, params);
  const error = new Error('MySQL is unavailable. Start XAMPP MySQL and configure terranav_db.');
  error.code = 'DB_UNAVAILABLE';
  throw error;
}

/**
 * Get current DB status information
 */
function getPoolStatus() {
  let mode = 'unavailable';
  if (isConnectedToMySQL) {
    mode = 'mysql';
  } else if (useInMemoryOnly) {
    mode = 'in-memory-test-fallback';
  } else if (allowInMemoryFallback) {
    mode = 'in-memory-fallback';
  }

  return {
    database: process.env.DB_NAME || 'terranav_db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    driver: 'mysql2/promise',
    connected: isConnectedToMySQL,
    persistent: isConnectedToMySQL,
    mode,
    connectionAttempted,
    fallbackEnabled: allowInMemoryFallback,
    inMemoryOnly: useInMemoryOnly
  };
}

function isPersistenceReady() {
  return isConnectedToMySQL;
}

// Initialize pool on module load
createPool();

module.exports = {
  createPool,
  testConnection,
  query,
  execute,
  getPoolStatus,
  isPersistenceReady,
  inMemoryStore
};
