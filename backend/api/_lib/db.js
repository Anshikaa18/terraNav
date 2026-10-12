/**
 * TerraNav AI — Database Layer (MySQL Pool + In-Memory Fallback Adapter)
 * Member 3: Backend Integration & Microservices
 */

const mysql = require('mysql2/promise');
const logger = require('./logging');

let pool = null;
let isConnectedToMySQL = false;
let connectionAttempted = false;

// In-Memory Database Fallback Store (Used when XAMPP MySQL is temporarily offline)
const inMemoryStore = {
  users: [],
  saved_places: [],
  route_history: [],
  incidents: [],
  autoIncrements: {
    users: 1,
    saved_places: 1,
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
    connectTimeout: 3000
  };

  try {
    pool = mysql.createPool(config);
    return pool;
  } catch (err) {
    logger.warn(`Failed to initialize MySQL pool: ${err.message}. Operating in memory fallback mode.`);
    return null;
  }
}

/**
 * Test Connection to MySQL with fast timeout
 */
async function testConnection() {
  connectionAttempted = true;
  if (!pool) {
    createPool();
  }

  if (!pool) {
    isConnectedToMySQL = false;
    return {
      connected: false,
      mode: 'in-memory-fallback',
      message: 'MySQL pool could not be initialized. Using in-memory store.'
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
    logger.warn(`MySQL connection test failed (${err.code || err.message}). Operating in in-memory fallback mode.`);
    return {
      connected: false,
      mode: 'in-memory-fallback',
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
  if (normalized.includes('FROM USERS')) {
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
    const [user_id, name, latitude, longitude, address, category] = params;
    const place = {
      id,
      user_id: parseInt(user_id, 10),
      name,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address: address || null,
      category: category || 'favorite',
      created_at: new Date().toISOString()
    };
    inMemoryStore.saved_places.push(place);
    return [{ insertId: id, affectedRows: 1 }, []];
  }

  // SELECT ... FROM saved_places
  if (normalized.includes('FROM SAVED_PLACES')) {
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
  if (normalized.includes('FROM ROUTE_HISTORY')) {
    if (normalized.includes('WHERE USER_ID = ? AND ID = ?')) {
      const [userId, id] = params;
      const match = inMemoryStore.route_history.filter(h => h.user_id === parseInt(userId, 10) && h.id === parseInt(id, 10));
      return [match, []];
    }
    if (normalized.includes('WHERE USER_ID = ?')) {
      const userId = parseInt(params[0], 10);
      const match = inMemoryStore.route_history.filter(h => h.user_id === userId);
      return [match, []];
    }
    return [inMemoryStore.route_history, []];
  }

  // DELETE FROM route_history
  if (normalized.startsWith('DELETE FROM ROUTE_HISTORY')) {
    const [userId, id] = params;
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
  if (normalized.includes('FROM INCIDENTS')) {
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
  if (isConnectedToMySQL && pool) {
    try {
      return await pool.query(sql, params);
    } catch (err) {
      logger.error(`MySQL query error: ${err.message}`, { sql, params });
      throw err;
    }
  }

  // Fallback to in-memory store
  return executeFallback(sql, params);
}

/**
 * Execute prepared statement
 */
async function execute(sql, params = []) {
  if (isConnectedToMySQL && pool) {
    try {
      return await pool.execute(sql, params);
    } catch (err) {
      logger.error(`MySQL execute error: ${err.message}`, { sql, params });
      throw err;
    }
  }

  // Fallback to in-memory store
  return executeFallback(sql, params);
}

/**
 * Get current DB status information
 */
function getPoolStatus() {
  return {
    database: process.env.DB_NAME || 'terranav_db',
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    driver: 'mysql2/promise',
    connected: isConnectedToMySQL,
    mode: isConnectedToMySQL ? 'mysql' : 'in-memory-fallback',
    connectionAttempted
  };
}

// Initialize pool on module load
createPool();

module.exports = {
  createPool,
  testConnection,
  query,
  execute,
  getPoolStatus,
  inMemoryStore
};
