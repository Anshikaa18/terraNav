export function normalizeTravelMode(mode) {
  const normalizedMode = String(mode).toLowerCase();
  if (normalizedMode.includes('walk') || normalizedMode.includes('pedestrian') || normalizedMode.includes('foot')) {
    return 'pedestrian';
  }
  if (normalizedMode === 'motorcycle' || normalizedMode === 'bike' || normalizedMode.includes('two')) {
    return 'motorcycle';
  }
  if (normalizedMode === 'bicycle' || normalizedMode === 'cycling' || normalizedMode === 'cycle') {
    return 'bicycle';
  }
  return 'car';
}
