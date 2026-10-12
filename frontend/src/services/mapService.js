import api from './api.js';

export const mapService = {
  async searchPlaces(q, lat = null, lon = null, limit = 8) {
    if (!q || !q.trim()) return [];
    const params = { q: q.trim(), limit };
    if (lat && lon) {
      params.lat = lat;
      params.lng = lon;
    }
    try {
      const res = await api.get('/api/services/geocode', { params });
      const list = res.data || res || [];
      return (Array.isArray(list) ? list : []).map(item => ({
        id: item.placeId || item.id || 'p_' + Math.random().toString(36).substr(2, 9),
        name: item.displayName || item.name,
        lat: item.latitude !== undefined ? item.latitude : item.lat,
        lon: item.longitude !== undefined ? item.longitude : (item.lon || item.lng),
        type: item.type,
        category: item.category || 'place'
      }));
    } catch (err) {
      console.warn('Geocode search error:', err.message);
      return [];
    }
  },

  async getNearby(category, lat, lon, radius = 5000, limit = 15) {
    if (!lat || !lon) throw new Error('Location is required for nearby search');
    const params = { category, lat, lng: lon, radius };
    try {
      const res = await api.get('/api/services/poi', { params });
      const list = res.data || res || [];
      return (Array.isArray(list) ? list : []).map(item => ({
        id: item.id || 'poi_' + Math.random().toString(36).substr(2, 9),
        name: item.name,
        category: item.category || category,
        lat: item.latitude !== undefined ? item.latitude : item.lat,
        lon: item.longitude !== undefined ? item.longitude : (item.lon || item.lng),
        tags: item.tags || {}
      }));
    } catch (err) {
      console.warn('POI search error:', err.message);
      return [];
    }
  },

  async getPlaceDetails({ id, lat, lon, osm_id, osm_type }) {
    if (lat && lon) {
      try {
        const res = await api.get('/api/services/reverse', { params: { lat, lng: lon } });
        const item = res.data || res;
        return {
          id: item.placeId || id || 'loc_' + Date.now(),
          name: item.displayName || `Location (${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)})`,
          lat: item.latitude !== undefined ? item.latitude : lat,
          lon: item.longitude !== undefined ? item.longitude : lon,
          address: item.address || {}
        };
      } catch (err) {
        return {
          id: id || 'loc_' + Date.now(),
          name: `Location (${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)})`,
          lat,
          lon,
          address: {}
        };
      }
    }
    return null;
  },
};
