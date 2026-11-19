export const TRAFFIC_STYLES = {
  free_flowing: { color: '#0b9e61', label: 'Free flow', pattern: 'solid' },
  moderate: { color: '#c88700', label: 'Moderate', pattern: 'solid' },
  heavy: { color: '#f0640d', label: 'Heavy', pattern: 'solid' },
  severe: { color: '#d32631', label: 'Severe', pattern: 'solid' },
  unknown: { color: '#788488', label: 'Unavailable', pattern: 'dash' },
};

const CLASS_ALIASES = {
  free: 'free_flowing', freeflow: 'free_flowing', free_flow: 'free_flowing',
  flowing: 'moderate', light: 'moderate', yellow: 'moderate', normal: 'moderate',
  slow: 'heavy', orange: 'heavy', congested: 'heavy',
  red: 'severe', jammed: 'severe', congestion: 'severe',
};

export function normalizeTrafficClass(value, { stale = false, valueType } = {}) {
  // Only provider observations can communicate a traffic severity. Predictions
  // and unavailable values remain visible as metadata, but map to neutral.
  if (stale || (valueType && valueType !== 'observed')) return 'unknown';
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TRAFFIC_STYLES[normalized] ? normalized : (CLASS_ALIASES[normalized] || 'unknown');
}

export function getTrafficStyle(segment) {
  const trafficClass = normalizeTrafficClass(segment?.trafficClass || segment?.congestionLevel, segment);
  return { trafficClass, ...TRAFFIC_STYLES[trafficClass] };
}

export function trafficSourceLabel(segment) {
  if (segment?.valueType === 'observed') return 'Observed traffic';
  if (segment?.valueType === 'predicted') return 'ChunkFlow prediction';
  return 'Traffic unavailable';
}

export function formatTrafficTimestamp(value) {
  if (!value) return 'No timestamp available';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Timestamp unavailable' : parsed.toLocaleString();
}
