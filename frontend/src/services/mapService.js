import api from './api.js';

export const mapService = {
  async searchPlaces(q, lat = null, lon = null, limit = 8, requestOptions = {}) {
    if (!q || !q.trim()) return [];
    const params = { q: q.trim(), limit };
    if (lat != null && lon != null) {
      params.lat = Number(lat);
      params.lng = Number(lon);
    }
    try {
      const res = await api.get('/api/services/geocode', { params, ...requestOptions });
      const list = res.data || res || [];
      return (Array.isArray(list) ? list : []).map(item => ({
        id: item.placeId || item.id || `place-${item.latitude ?? item.lat},${item.longitude ?? item.lon ?? item.lng}`,
        name: item.displayName ? item.displayName.split(',')[0].trim() : (item.name || 'Location'),
        displayName: item.displayName || item.name,
        display_name: item.displayName || item.name,
        lat: item.latitude !== undefined ? item.latitude : item.lat,
        lon: item.longitude !== undefined ? item.longitude : (item.lon ?? item.lng),
        latitude: item.latitude !== undefined ? item.latitude : item.lat,
        longitude: item.longitude !== undefined ? item.longitude : (item.lon ?? item.lng),
        distanceMeters: item.distanceMeters,
        distanceKm: item.distanceMeters != null ? item.distanceMeters / 1000 : item.distanceKm,
        type: item.type,
        category: item.category || 'place',
        address: item.address || {}
      }));
    } catch (err) {
      if (err?.code === 'ERR_CANCELED' || requestOptions.signal?.aborted) throw err;
      console.warn('Geocode search error:', err.message);
      throw err;
    }
  },

  async getNearby(category, lat, lon, radius = 5000, limit = 15) {
    if (lat == null || lon == null) throw new Error('Location is required for nearby search');
    const params = { category, lat, lng: lon, radius, limit };
    try {
      const res = await api.get('/api/services/poi', { params });
      const list = res.data || res || [];
      return (Array.isArray(list) ? list : []).map(item => {
        const tags = item.tags || {};
        const address = item.address || '';
        return {
          id: item.id || `${item.type || 'poi'}-${item.osmId || item.osm_id || item.name || `${item.latitude},${item.longitude}`}`,
          name: item.name || 'Unnamed place',
          displayName: address,
          display_name: address,
          category: item.category || category,
          lat: item.latitude !== undefined ? item.latitude : item.lat,
          lon: item.longitude !== undefined ? item.longitude : (item.lon ?? item.lng),
          distanceMeters: item.distanceMeters,
          distanceKm: item.distanceMeters != null ? item.distanceMeters / 1000 : null,
          address,
          phone: tags.phone || tags['contact:phone'],
          website: tags.website || tags['contact:website'],
          opening_hours: tags.opening_hours,
          tags
        };
      });
    } catch (err) {
      console.warn('POI search error:', err.message);
      throw err;
    }
  },

  async getPlaceDetails({ id, lat, lon, osm_id, osm_type }) {
    if (lat != null && lon != null) {
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
