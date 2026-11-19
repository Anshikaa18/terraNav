import api from './api.js';
import { toLatLng, toLeafletPoint } from '../utils/coordinates.js';
import { normalizeTrafficClass } from '../utils/traffic.js';
import { formatDistance, formatDuration } from '../utils/geo.js';
import { normalizeTravelMode } from '../utils/travelMode.js';
export { normalizeTravelMode } from '../utils/travelMode.js';

export const distanceText = (meters) => {
  const value = Number(meters);
  if (!Number.isFinite(value) || value < 0) return 'Distance unavailable';
  return formatDistance(value / 1000) || 'Distance unavailable';
};

function stepDistanceMeters(step) {
  if (step.distanceMeters != null) return Number(step.distanceMeters);
  if (typeof step.distance === 'number') return step.distance;
  if (typeof step.distance !== 'string') return null;
  const match = step.distance.trim().match(/^([\d,.]+)\s*(km|kilometers?|m|meters?)?$/i);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(amount) ? amount * (/^km|^kilometer/i.test(match[2] || '') ? 1000 : 1) : null;
}

const normalizeCoordinates = (geometry) => (Array.isArray(geometry) ? geometry.map(toLeafletPoint).filter(Boolean) : []);

function normalizeSegment(segment, index) {
  const valueType = segment.valueType || segment.sourceType || (segment.predictedSpeedKmh != null ? 'predicted' : segment.observedSpeedKmh != null ? 'observed' : 'unavailable');
  return {
    ...segment,
    segmentId: segment.segmentId || segment.id || `segment-${index}`,
    coordinates: normalizeCoordinates(segment.coordinates || segment.geometry?.coordinates || segment.shape),
    valueType,
    stale: Boolean(segment.stale || segment.isStale || valueType === 'unavailable'),
    trafficClass: normalizeTrafficClass(segment.trafficClass || segment.congestionLevel, {
      stale: Boolean(segment.stale || segment.isStale),
      valueType: valueType === 'observed' ? 'observed' : 'unavailable'
    }),
  };
}

function normalizeRoute(route, index, topLevelSegments, summary) {
  const segments = (route.segments || route.chunks || topLevelSegments || []).map(normalizeSegment).filter((segment) => segment.coordinates.length >= 2);
  const coordinates = normalizeCoordinates(route.coordinates || route.geometry?.coordinates || route.shape);
  const geometry = coordinates.length >= 2 ? coordinates : segments.flatMap((segment) => segment.coordinates);
  const metrics = route.metrics || (route.summary && typeof route.summary === 'object' ? route.summary : summary) || {};
  const duration = route.durationSeconds ?? route.duration ?? metrics.totalDurationSeconds;
  const distance = route.distanceMeters ?? route.distance ?? metrics.totalDistanceMeters;
  const timeSavedSeconds = route.timeSavedSeconds ?? metrics.timeSavedSeconds;

  const rawSteps = route.steps || [];
  const steps = rawSteps.map(step => {
    const dist = stepDistanceMeters(step);
    return {
      ...step,
      distanceText: dist != null ? distanceText(dist) : step.distance
    };
  });

  return {
    ...route,
    id: route.routeId || route.id || `route-${index + 1}`,
    routeId: route.routeId || route.id || `route-${index + 1}`,
    coordinates: geometry,
    segments,
    summary: (route.name || route.summaryText || (typeof route.summary === 'string' ? route.summary : null) || (segments[0]?.roadName && segments[0]?.roadName !== 'Unnamed road' ? `Via ${segments[0].roadName}` : `Route ${index + 1}`)).replace(/^via\s+via\s+/i, 'Via ').trim(),
    duration,
    distance,
    durationText: formatDuration(duration) || 'ETA unavailable',
    distanceText: distanceText(distance),
    timeSavedSeconds,
    traditionalDurationSeconds: route.traditionalDurationSeconds ?? metrics.traditionalDurationSeconds,
    traditionalDurationText: formatDuration(route.traditionalDurationSeconds ?? metrics.traditionalDurationSeconds) || 'ETA unavailable',
    timeSavedText: route.timeSavedText || (timeSavedSeconds > 0 ? `${formatDuration(timeSavedSeconds)} saved` : 'Traffic-aware route'),
    durationSource: route.durationSource || metrics.durationSource || 'routing-provider',
    trafficAdjusted: (route.durationSource || metrics.durationSource) === 'routing-provider-plus-live-traffic',
    steps,
  };
}

export function normalizeResponse(data) {
  data = data?.data || data || {};
  const summary = data.summary || {};
  const rawRoutes = Array.isArray(data.routes) && data.routes.length ? data.routes : [{
    routeId: data.routeId || 'dynamic-route-1', segments: data.segments || data.chunks || [],
    coordinates: data.coordinates || data.geometry?.coordinates, steps: data.steps || [],
  }];
  const routes = rawRoutes.map((route, index) => normalizeRoute(route, index, data.segments || data.chunks, summary)).filter((route) => route.coordinates.length >= 2);
  if (!routes.length) throw new Error('The routing service returned no usable road geometry. Please try another destination.');
  return { ...data, success: true, summary, routes, selectedRouteId: data.selectedRouteId || data.routeId || routes[0].routeId };
}

export const directionService = {
  async getDirections(fromCoords, toCoords, mode = 'car', { signal, simulatedIncident, originName, destinationName } = {}) {
    const origin = toLatLng(fromCoords);
    const destination = toLatLng(toCoords);
    if (!origin || !destination) throw new Error('Valid origin and destination coordinates are required.');
    const backendMode = normalizeTravelMode(mode);
    const data = await api.post('/api/directions/dynamic', {
      origin: { lat: origin.lat, lng: origin.lng }, destination: { lat: destination.lat, lng: destination.lng }, mode: backendMode,
      originName: typeof originName === 'string' ? originName.trim() : '',
      destinationName: typeof destinationName === 'string' ? destinationName.trim() : '',
      simulatedIncident: simulatedIncident || undefined,
    }, { signal });
    return normalizeResponse(data);
  },
};
