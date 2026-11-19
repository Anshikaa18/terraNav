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
        display_name: p.address,
        category: p.category || 'favorite',
        collectionName: p.collection_name || 'Favorites',
        notes: p.notes || '',
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
      address: placeData.address || placeData.display_name || null,
      category: placeData.category || 'place',
      collectionName: placeData.collectionName || 'Favorites',
      notes: placeData.notes || null,
    };
    const res = await api.post('/api/saved', payload);
    const data = res.data || res;
    return {
      id: data.id,
      name: data.name,
      lat: Number(data.latitude || data.lat),
      lon: Number(data.longitude || data.lon),
      address: data.address,
      category: data.category,
      collectionName: data.collectionName,
      notes: data.notes
    };
  },

  async deleteSavedPlace(id) {
    const res = await api.delete(`/api/saved/${id}`);
    return res.data || res;
  },

  async getSavedLists() {
    const places = await this.getSavedPlaces();
    const savedNames = new Set(places.map((place) => place.collectionName).filter(Boolean));
    return [
      { id: 'favorites', name: 'Favorites', icon: 'heart', description: 'Quick access places' },
      { id: 'work', name: 'Work & Transit', icon: 'briefcase', description: 'Daily commutes' },
      ...[...savedNames].filter((name) => !['Favorites', 'Work & Transit'].includes(name)).map((name) => ({ id: name, name, icon: 'bookmark' }))
    ];
  },

  async createSavedList(name, icon = 'bookmark', description = '') {
    return { id: name.trim(), name: name.trim(), icon, description };
  },

  async deleteSavedList(id) {
    return { deleted: true, id };
  },
};
