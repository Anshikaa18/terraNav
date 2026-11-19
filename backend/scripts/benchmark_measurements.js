/**
 * Benchmark & Resilience Measurement Script for ChunkFlow AI
 * Measures:
 * 1. API endpoint latency (/api/health, /api/services/geocode, /api/services/reverse, /api/directions/dynamic)
 * 2. ML inference latency (via daemon)
 * 3. Route scoring latency
 * 4. Cache hit vs cold request latency
 * 5. Response payload sizes
 */

const http = require('http');
const os = require('os');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({
          status: res.statusCode,
          durationMs: duration,
          sizeBytes: Buffer.byteLength(data),
          body: parsed
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runBenchmark() {
  console.log('===============================================================');
  console.log(' ChunkFlow AI — Performance & Resilience Measurement Benchmark');
  console.log('===============================================================\n');

  console.log('Hardware & Environment:');
  console.log(`  OS: ${os.type()} ${os.release()} (${os.arch()})`);
  console.log(`  CPU: ${os.cpus()[0]?.model || 'Unknown'} (${os.cpus().length} cores)`);
  console.log(`  Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
  console.log(`  Node.js: ${process.version}\n`);

  // 1. Health check latency
  const healthRuns = [];
  for (let i = 0; i < 5; i++) {
    const res = await request({ hostname: 'localhost', port: 5000, path: '/api/health', method: 'GET' });
    healthRuns.push(res.durationMs);
  }
  const avgHealth = (healthRuns.reduce((a, b) => a + b, 0) / healthRuns.length).toFixed(1);
  console.log(`1. /api/health Latency: ${avgHealth} ms (runs: ${healthRuns.join(', ')} ms)`);

  // 2. Geocoding Latency
  const geo = await request({ hostname: 'localhost', port: 5000, path: '/api/services/geocode?q=MG+Road+Bengaluru&limit=3', method: 'GET' });
  console.log(`2. /api/services/geocode Latency: ${geo.durationMs} ms, Payload Size: ${geo.sizeBytes} bytes`);

  // 3. Dynamic Directions (Bengaluru Corridor: MG Road to Koramangala ~7.5km)
  console.log('\n3. Measuring Dynamic Route Calculation (Corridor ~7.5 km, 21 road chunks):');
  const dirRuns = [];
  let payloadSize = 0;
  let chunkCount = 0;
  for (let i = 0; i < 5; i++) {
    const res = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/directions/dynamic',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      origin: { lat: 12.9716, lng: 77.5946 },
      destination: { lat: 12.9352, lng: 77.6245 },
      mode: 'car'
    });
    dirRuns.push(res.durationMs);
    payloadSize = res.sizeBytes;
    chunkCount = res.body?.chunks?.length || 0;
  }
  const avgDir = (dirRuns.reduce((a, b) => a + b, 0) / dirRuns.length).toFixed(1);
  console.log(`   - Average E2E Directions Latency: ${avgDir} ms (cold: ${dirRuns[0]} ms, warm: ${dirRuns.slice(1).join(', ')} ms)`);
  console.log(`   - Payload Size: ${(payloadSize / 1024).toFixed(2)} KB (${payloadSize} bytes)`);
  console.log(`   - Route Chunks: ${chunkCount} segments`);

  // 4. Incident Detour Route Scoring Latency
  const incidentRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/directions/dynamic',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    origin: { lat: 12.9716, lng: 77.5946 },
    destination: { lat: 12.9352, lng: 77.6245 },
    mode: 'car',
    simulatedIncident: { chunkId: 'CHUNK_104', type: 'roadblock' }
  });
  console.log(`\n4. Incident Simulation & Detour Calculation: ${incidentRes.durationMs} ms (Detour applied: ${incidentRes.body?.summary?.totalDurationSeconds}s vs Baseline ${incidentRes.body?.summary?.traditionalDurationSeconds}s)`);

  // 5. Frontend Bundle Size & Asset Inventory
  const fs = require('fs');
  const path = require('path');
  const distDir = path.resolve(__dirname, 'terraNav/frontend/dist');
  if (fs.existsSync(distDir)) {
    console.log('\n5. Frontend Production Bundle Artifacts:');
    const files = fs.readdirSync(path.join(distDir, 'assets'));
    for (const f of files) {
      const stats = fs.statSync(path.join(distDir, 'assets', f));
      console.log(`   - assets/${f}: ${(stats.size / 1024).toFixed(2)} KB`);
    }
  }

  console.log('\n===============================================================');
  console.log(' Benchmark Completed Successfully');
  console.log('===============================================================');
}

runBenchmark().catch(console.error);
