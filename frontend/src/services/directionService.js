import api from './api.js';
import { toLatLng, toLeafletPoint } from '../utils/coordinates.js';

export const directionService = {
  async getDirections(fromCoords, toCoords, mode = 'car', simulatedIncident = null) {
    const origin = toLatLng(fromCoords);
    const destination = toLatLng(toCoords);

    if (!origin || !destination) {
      throw new Error('Valid origin and destination coordinates are required.');
    }

    // Normalize mode for backend (car, motorcycle, pedestrian)
    let backendMode = 'car';
    const m = String(mode).toLowerCase();
    if (m.includes('walk') || m.includes('pedestrian') || m.includes('foot')) {
      backendMode = 'pedestrian';
    } else if (m.includes('bike') || m.includes('motorcycle') || m.includes('cycle') || m.includes('two')) {
      backendMode = 'motorcycle';
    } else {
      backendMode = 'car';
    }

    const payload = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      mode: backendMode,
      simulatedIncident: simulatedIncident || undefined
    };

    // Call dynamic directions endpoint on backend
    const res = await api.post('/api/directions/dynamic', payload);
    const data = res.data || res;

    // Collect all road coordinates from the chunks
    const chunks = data.chunks || [];
    const allCoordinates = [];

    chunks.forEach(chunk => {
      if (Array.isArray(chunk.coordinates)) {
        chunk.coordinates.forEach(pt => {
          const leafPt = toLeafletPoint(pt);
          if (leafPt) {
            allCoordinates.push(leafPt);
          }
        });
      }
    });

    // Fallback coordinates if chunk coordinates are empty
    const fallbackCoords = [
      [origin.lat, origin.lng],
      [destination.lat, destination.lng]
    ];

    const totalDistMeters = data.summary?.totalDistanceMeters || 0;
    const totalDurationSecs = data.summary?.totalDurationSeconds || 0;
    const tradDurationSecs = data.summary?.traditionalDurationSeconds || 0;
    const timeSavedSecs = data.summary?.timeSavedSeconds || 0;

    const formattedSteps = (data.steps || []).map((s, idx) => ({
      instruction: s.instruction,
      distanceText: s.distance || `${Math.round(totalDistMeters / (data.steps.length || 1))}m`,
      name: s.roadName || '',
      type: idx === 0 ? 'depart' : (idx === data.steps.length - 1 ? 'arrive' : 'turn'),
      modifier: ''
    }));

    const primaryRoute = {
      id: 'dynamic-route-1',
      summary: chunks[0]?.roadName ? `Dynamic Route via ${chunks[0].roadName}` : 'Dynamic Route',
      distance: totalDistMeters,
      duration: totalDurationSecs,
      distanceText: totalDistMeters >= 1000 ? `${(totalDistMeters / 1000).toFixed(1)} km` : `${totalDistMeters} m`,
      durationText: totalDurationSecs >= 60 ? `${Math.ceil(totalDurationSecs / 60)} min` : `${totalDurationSecs} s`,
      traditionalDurationText: tradDurationSecs >= 60 ? `${Math.ceil(tradDurationSecs / 60)} min` : `${tradDurationSecs} s`,
      timeSavedText: timeSavedSecs > 0 ? `${Math.ceil(timeSavedSecs / 60)} min saved` : 'Optimal Route',
      timeSavedSeconds: timeSavedSecs,
      traditionalDurationSeconds: tradDurationSecs,
      coordinates: allCoordinates.length > 0 ? allCoordinates : fallbackCoords,
      steps: formattedSteps,
      chunks: chunks
    };

    return {
      success: true,
      summary: data.summary,
      chunks: chunks,
      steps: data.steps,
      routes: [primaryRoute]
    };
  },
};
