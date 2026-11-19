/**
 * ChunkFlow AI & TerraNav ML — Unified Inference and Graph Routing Adapter
 *
 * Bridges the Node.js Express backend to the persistent Python serving daemon
 * (src/terranav/serving/api.py). Uses one persistent process for offline model
 * diagnostics and research graph operations. Synthetic model outputs are not
 * consumed by live route costs.
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const logger = require('../_lib/logging');

const fs = require('fs');
const PYTHON = process.env.CHUNKFLOW_PYTHON || 'python';
const BACKEND_DIR = path.resolve(__dirname, '../..');
const REPO_ROOT = process.env.REPO_ROOT || path.resolve(BACKEND_DIR, '..');
const PYTHON_SRC = [
  path.join(BACKEND_DIR, 'ml'),
  path.join(REPO_ROOT, 'ml'),
  path.join(REPO_ROOT, 'src')
].find(p => fs.existsSync(p)) || path.join(BACKEND_DIR, 'ml');
const MODEL_VERSION = process.env.CHUNKFLOW_MODEL_VERSION || 'TerraNav-Research-v1.0';

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// Inference may only use a complete, explicitly supplied model feature vector.
// Route geometry and provider traffic fields do not contain the model's training
// features, and filling them with guessed or synthetic defaults is unsafe.
function buildModelInput(chunk, featureColumns = []) {
  const features = chunk?.modelFeatures;
  if (!features || typeof features !== 'object' || Array.isArray(features) || featureColumns.length === 0) return null;
  if (featureColumns.some(column => features[column] == null || !Number.isFinite(Number(features[column])))) return null;
  const lengthMeters = finite(chunk.lengthMeters, null);
  if (lengthMeters === null || lengthMeters <= 0) return null;
  return {
    ...Object.fromEntries(featureColumns.map(column => [column, Number(features[column])])),
    length_meters: lengthMeters,
    is_closed: chunk.roadClosure === true
  };
}

class InferenceDaemon {
  constructor() {
    this.process = null;
    this.rl = null;
    this.pending = new Map();
    this.reqId = 0;
    this.ready = false;
    this.initializing = null;
    this.isTerraNav = false;
    this.networkNodes = null;
    this.featureColumns = [];
  }

  ensureStarted() {
    if (this.process && !this.process.killed) return Promise.resolve();
    if (this.initializing) return this.initializing;

    this.initializing = new Promise((resolve, reject) => {
      try {
        // First try the production terranav serving daemon
        const proc = spawn(PYTHON, ['-u', '-m', 'terranav.serving.api', '--daemon'], {
          cwd: REPO_ROOT,
          env: { ...process.env, PYTHONPATH: PYTHON_SRC },
          windowsHide: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process = proc;
        this.rl = readline.createInterface({ input: proc.stdout });

        const startupTimeoutMs = Number(process.env.CHUNKFLOW_DAEMON_STARTUP_TIMEOUT_MS || 25000);
        let started = false;
        const startupTimeout = setTimeout(() => {
          if (started) return;
          logger.warn('TerraNav daemon startup timed out.');
          proc.kill();
          reject(new Error('TerraNav daemon startup timed out'));
        }, startupTimeoutMs);

        this.rl.on('line', line => {
          line = line.trim();
          if (!line) return;
          try {
            const data = JSON.parse(line);
            if (data.ready) {
              clearTimeout(startupTimeout);
              this.ready = true;
              this.isTerraNav = true;
              this.featureColumns = Array.isArray(data.featureColumns) ? data.featureColumns : [];
              started = true;
              logger.info(`TerraNav ML & Routing daemon ready (${data.modelVersion || MODEL_VERSION})`);
              resolve();
              return;
            }
            if (data.id !== undefined && this.pending.has(data.id)) {
              const { reqResolve, reqTimeout } = this.pending.get(data.id);
              clearTimeout(reqTimeout);
              this.pending.delete(data.id);
              reqResolve(data);
            }
          } catch (e) {
            logger.warn(`TerraNav daemon non-JSON output: ${line}`);
          }
        });

        proc.stderr.on('data', data => {
          const msg = data.toString().trim();
          if (msg && !msg.includes('InconsistentVersionWarning') && !msg.includes('UserWarning')) {
            logger.warn(`TerraNav daemon stderr: ${msg}`);
          }
        });

        proc.on('error', err => {
          clearTimeout(startupTimeout);
          logger.warn(`TerraNav daemon spawn error: ${err.message}`);
          this.cleanup();
          if (!started) reject(err);
        });

        proc.on('close', code => {
          clearTimeout(startupTimeout);
          if (code !== 0 && code !== null) {
            logger.warn(`TerraNav daemon closed with code ${code}`);
          }
          this.cleanup();
          if (!started) reject(new Error(`TerraNav daemon exited before becoming ready (code ${code})`));
        });
      } catch (err) {
        logger.warn(`TerraNav daemon initialization failed: ${err.message}`);
        this.cleanup();
        reject(err);
      }
    }).finally(() => {
      this.initializing = null;
    });

    return this.initializing;
  }

  cleanup() {
    this.ready = false;
    this.process = null;
    this.rl = null;
    for (const [, { reqReject, reqTimeout }] of this.pending) {
      clearTimeout(reqTimeout);
      reqReject(new Error('ML daemon terminated'));
    }
    this.pending.clear();
  }

  async sendRequest(payload) {
    await this.ensureStarted();

    if (!this.process || !this.ready) {
      throw new Error('Persistent TerraNav daemon is unavailable');
    }

    const id = ++this.reqId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('ML inference timed out'));
        }
      }, Number(process.env.CHUNKFLOW_TIMEOUT_MS || 12000));

      this.pending.set(id, { reqResolve: resolve, reqReject: reject, reqTimeout: timeout });
      this.process.stdin.write(JSON.stringify({ id, ...payload }) + '\n', error => {
        if (!error || !this.pending.has(id)) return;
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }
}

const daemon = new InferenceDaemon();

async function runInference(payload) {
  try {
    const output = await daemon.sendRequest(payload);
    if (!output || typeof output !== 'object') throw new Error('ML daemon returned an invalid response');
    return output;
  } catch (error) {
    logger.warn(`ML inference unavailable: ${error.message}`);
    return { ok: false, error: 'ML model is unavailable', code: 'MODEL_UNAVAILABLE' };
  }
}

async function predictBatch(chunks) {
  await daemon.ensureStarted().catch(() => { });
  const inputs = chunks.map(chunk => buildModelInput(chunk, daemon.featureColumns));
  const validIndices = inputs.flatMap((input, index) => input ? [index] : []);
  const output = validIndices.length
    ? await runInference({ action: 'predict', rows: validIndices.map(index => inputs[index]) })
    : { ok: false, error: 'Live route data does not include the complete trained model feature schema.', code: 'MODEL_FEATURES_UNAVAILABLE' };
  let predictionIndex = 0;
  return chunks.map((chunk, index) => {
    const eligible = validIndices.includes(index);
    const result = output.ok && eligible ? output.predictions?.[predictionIndex++] : null;
    const predictedSpeedKmh = finite(result?.predicted_speed_kmh, null);
    const predictedDensityVehiclesPerKm = null;
    return {
      ...chunk,
      predictedSpeedKmh,
      predictedDensityVehiclesPerKm,
      modelVersion: result ? MODEL_VERSION : null,
      predictedAt: result ? new Date().toISOString() : null,
      predictionStatus: result ? 'research_only' : 'unavailable',
      predictionError: result
        ? 'Model was trained on synthetic segment-speed targets and is excluded from live route costs.'
        : output.error || 'ML prediction unavailable'
    };
  });
}

/**
 * Calculate optimal shortest-path route on the directed road network via Python graph optimizer.
 */
async function calculateGraphRoute({ origin, destination, algorithm = 'astar', strategy = 'ml_dynamic' }) {
  const payload = {
    action: 'route',
    origin,
    destination,
    algorithm,
    strategy
  };
  return runInference(payload);
}

/**
 * Evaluate dynamic rerouting policy against current active trip.
 */
async function evaluateReroute({ currentNode, destination, currentTimestamp = null, tripId = null }) {
  const payload = {
    action: 'reroute',
    current_node: currentNode,
    destination,
    current_timestamp: currentTimestamp || (Date.now() / 1000)
  };
  if (tripId) payload.trip_id = String(tripId);
  return runInference(payload);
}

/**
 * Update dynamic edge costs with new observations or closures.
 */
async function updateGraphTraffic(updates) {
  return runInference({ action: 'update_traffic', updates });
}

/**
 * Retrieve road network metadata and list of supported corridor nodes.
 */
async function getNetworkInfo() {
  return runInference({ action: 'network_info' });
}

/**
 * Check whether a requested trip falls within the supported Bengaluru arterial road network.
 */
async function canRouteOnGraph(origin, destination) {
  try {
    const info = await getNetworkInfo();
    if (!info.ok || !info.nodes || info.operational_for_live_routing !== true) return false;

    const nodes = Object.values(info.nodes);
    function isNearNode(point) {
      if (typeof point === 'string') {
        const clean = point.trim().toLowerCase();
        return nodes.some(n => n.id.toLowerCase() === clean || n.name.toLowerCase() === clean);
      }
      if (typeof point === 'object' && point.lat && point.lng) {
        const pLat = Number(point.lat);
        const pLng = Number(point.lng);
        // Bounding box of Bengaluru network (~12.80 to 13.10 N, 77.50 to 77.75 E)
        return pLat >= 12.80 && pLat <= 13.10 && pLng >= 77.50 && pLng <= 77.75;
      }
      return false;
    }

    return isNearNode(origin) && isNearNode(destination);
  } catch (e) {
    return false;
  }
}

module.exports = {
  buildModelInput,
  predictBatch,
  calculateGraphRoute,
  evaluateReroute,
  updateGraphTraffic,
  getNetworkInfo,
  canRouteOnGraph,
  MODEL_VERSION,
  daemon
};
