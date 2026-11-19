/**
 * ChunkFlow bundle must use the leakage-free 17-feature schema.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const python = process.env.CHUNKFLOW_PYTHON || 'python';
const mlDir = [
  path.resolve(__dirname, '../ml/legacy'),
  path.resolve(__dirname, '../ml'),
  path.resolve(__dirname, '../../ml/legacy'),
  path.resolve(__dirname, '../../ml'),
  path.resolve(__dirname, '../../ML')
].find(p => fs.existsSync(p)) || path.resolve(__dirname, '../ml/legacy');
const script = `
import json
from chunkflow_pipeline import FEATURE_COLUMNS, FEATURE_SCHEMA_VERSION, MODEL_VERSION
assert FEATURE_SCHEMA_VERSION == "clean-17-v1", FEATURE_SCHEMA_VERSION
assert len(FEATURE_COLUMNS) == 17, len(FEATURE_COLUMNS)
assert not any(c.startswith("x_LEAK_") for c in FEATURE_COLUMNS)
print(json.dumps({"ok": True, "modelVersion": MODEL_VERSION, "features": len(FEATURE_COLUMNS)}))
`;

const result = spawnSync(python, ['-c', script], {
  cwd: mlDir,
  encoding: 'utf8'
});

if (result.status !== 0) {
  console.error('  ✗ FAIL: ML schema assertion failed');
  console.error(result.stderr || result.stdout);
  process.exit(1);
}

console.log(`  ✓ PASS: ML bundle schema verified (${result.stdout.trim()})`);

const adapter = require('../api/directions/mlAdapter');
const featureColumns = JSON.parse(result.stdout.trim()).features;
if (adapter.buildModelInput({ lengthMeters: 300 }, Array(featureColumns).fill('feature')) !== null) {
  console.error('  ✗ FAIL: Adapter fabricated incomplete model inputs');
  process.exit(1);
}
const suppliedColumns = Array.from({ length: featureColumns }, (_, index) => `feature_${index}`);
const supplied = Object.fromEntries(suppliedColumns.map((name, index) => [name, index]));
const mapped = adapter.buildModelInput({ lengthMeters: 300, modelFeatures: supplied }, suppliedColumns);
if (!mapped || mapped.length_meters !== 300 || mapped.feature_0 !== 0 || mapped.feature_16 !== 16) {
  console.error('  ✗ FAIL: Adapter did not preserve the complete supplied model feature vector');
  process.exit(1);
}
console.log('  ✓ PASS: ML adapter rejects missing features and preserves complete supplied rows without synthetic defaults');
process.exit(0);
