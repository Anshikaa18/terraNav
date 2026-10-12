import api from './api.js';

export const historyService = {
  async getHistory() {
    try {
      const res = await api.get('/api/history');
      const list = res.data || res || [];
      return (Array.isArray(list) ? list : []).map(h => ({
        id: h.id,
        query: `${h.origin_name || 'Origin'} ➔ ${h.dest_name || 'Destination'}`,
        timestamp: h.created_at,
        mode: h.transport_mode,
        distanceMeters: h.total_distance_meters,
        durationSeconds: h.total_duration_seconds,
        timeSavedSeconds: h.time_saved_seconds,
        origin: { lat: Number(h.origin_lat), lon: Number(h.origin_lng), name: h.origin_name },
        destination: { lat: Number(h.dest_lat), lon: Number(h.dest_lng), name: h.dest_name }
      }));
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
      console.warn('Delete history error:', err.message);
      return { success: false };
    }
  },

  async clearHistory() {
    return { success: true };
  },
};
