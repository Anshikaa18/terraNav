/**
 * TerraNav Centralized Coordinate Conversion Utilities
 * 
 * Conventions:
 * - Application coordinate object: { lat: number, lng: number }
 * - Leaflet point array: [lat, lng]
 * - GeoJSON coordinate array: [lng, lat]
 */

export function toLatLng(point) {
  if (!point) return null;

  // String: "21.2449,81.6431"
  if (typeof point === 'string') {
    const parts = point.split(',').map(s => parseFloat(s.trim()));
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
    return null;
  }

  // Array: [lat, lng]
  if (Array.isArray(point)) {
    if (point.length >= 2 && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1]))) {
      return { lat: Number(point[0]), lng: Number(point[1]) };
    }
    return null;
  }

  // Object: { lat, lng } or { lat, lon } or { latitude, longitude }
  if (typeof point === 'object') {
    const lat = point.lat !== undefined ? Number(point.lat) : (point.latitude !== undefined ? Number(point.latitude) : NaN);
    const lng = point.lng !== undefined ? Number(point.lng) : (point.lon !== undefined ? Number(point.lon) : (point.longitude !== undefined ? Number(point.longitude) : NaN));

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  return null;
}

export function toLeafletPoint(point) {
  const pt = toLatLng(point);
  if (!pt) return null;
  return [pt.lat, pt.lng];
}

export function toGeoJSONPoint(point) {
  const pt = toLatLng(point);
  if (!pt) return null;
  return [pt.lng, pt.lat];
}

export function isValidLatLng(point) {
  const pt = toLatLng(point);
  if (!pt) return false;
  return pt.lat >= -90 && pt.lat <= 90 && pt.lng >= -180 && pt.lng <= 180;
}
