import api from './api.js';

export const savedPlaceService = {
  async getSavedPlaces(listId = null) {
    try {
      const res = await api.get('/api/saved');
      const list = res.data || res || [];
      return (Array.isArray(list) ? list : []).map(p => ({
        id: p.id,
        name: p.name,
        lat: Number(p.latitude),
        lon: Number(p.longitude),
        address: p.address,
        category: p.category || 'favorite',
        createdAt: p.created_at
      }));
    } catch (err) {
      console.warn('Get saved places error:', err.message);
      return [];
    }
  },

  async savePlace(placeData) {
    const payload = {
      name: placeData.name || 'Saved Place',
      latitude: placeData.lat !== undefined ? Number(placeData.lat) : Number(placeData.latitude),
      longitude: placeData.lon !== undefined ? Number(placeData.lon) : (placeData.lng !== undefined ? Number(placeData.lng) : Number(placeData.longitude)),
      address: placeData.address || null,
      category: placeData.category || 'favorite'
    };
    const res = await api.post('/api/saved', payload);
    const data = res.data || res;
    return {
      id: data.id,
      name: data.name,
      lat: Number(data.latitude || data.lat),
      lon: Number(data.longitude || data.lon),
      address: data.address,
      category: data.category
    };
  },

  async deleteSavedPlace(id) {
    const res = await api.delete(`/api/saved/${id}`);
    return res.data || res;
  },

  async getSavedLists() {
    return [
      { id: 'favorites', name: 'Favorites', icon: 'heart', description: 'Quick access places' },
      { id: 'work', name: 'Work & Transit', icon: 'briefcase', description: 'Daily commutes' }
    ];
  },

  async createSavedList(name, icon = 'bookmark', description = '') {
    return { id: 'list_' + Date.now(), name, icon, description };
  },

  async deleteSavedList(id) {
    return { deleted: true, id };
  },
};
