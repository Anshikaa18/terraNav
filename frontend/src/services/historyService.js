import api from './api.js';

export const historyService = {
  async getHistory() {
    try {
      const res = await api.get('/api/history');
      const list = res.data || res || [];
      return (Array.isArray(list) ? list : []).map(h => {
        const origin = { lat: Number(h.origin_lat), lon: Number(h.origin_lng), name: h.origin_name || `${h.origin_lat}, ${h.origin_lng}` };
        const destination = { lat: Number(h.dest_lat), lon: Number(h.dest_lng), name: h.dest_name || `${h.dest_lat}, ${h.dest_lng}` };
        const rawTimestamp = h.created_at || h.createdAt || null;
        const timestamp = rawTimestamp && !Number.isNaN(new Date(rawTimestamp).getTime()) ? new Date(rawTimestamp).toISOString() : null;
        return {
          id: h.id,
          query: `${origin.name} ➔ ${destination.name}`,
          timestamp,
          mode: h.transport_mode,
          distanceMeters: h.total_distance_meters,
          durationSeconds: h.total_duration_seconds,
          timeSavedSeconds: h.time_saved_seconds,
          origin,
          destination
        };
      });
    } catch (err) {
      console.warn('Get history error:', err.message);
      return [];
    }
  },

  async recordSearch(query, selectedPlace = null) {
    if (!query) return;
    // History is auto-recorded during authenticated route calls or via manual logging
  },

  async deleteHistoryItem(id) {
    try {
      const res = await api.delete(`/api/history/${id}`);
      return res.data || res;
    } catch (err) {
      throw err;
    }
  },

  async clearHistory() {
    const res = await api.delete('/api/history');
    return res.data || res;
  },
};
