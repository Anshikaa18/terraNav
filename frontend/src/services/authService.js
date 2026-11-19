import api from './api.js';
import { getStoredToken, setStoredToken, clearStoredToken } from './tokenStorage.js';

export const authService = {
  async register(nameOrUsername, email, password) {
    const username = nameOrUsername ? nameOrUsername.trim().replace(/\s+/g, '_') : 'user_' + Date.now();
    const res = await api.post('/api/auth/register', { username, email, password });
    const payload = res.data || res;
    const token = payload.token;
    if (token) {
      setStoredToken(token);
    }
    return payload;
  },

  async login(email, password) {
    const res = await api.post('/api/auth/login', { email, password });
    const payload = res.data || res;
    const token = payload.token;
    if (token) {
      setStoredToken(token);
    }
    return payload;
  },

  async getMe() {
    const token = getStoredToken();
    if (!token) {
      return null;
    }
    try {
      const res = await api.get('/api/auth/me');
      const payload = res.data || res;
      return payload.user || payload;
    } catch (err) {
      if (err.response?.status === 401 || err.statusCode === 401) {
        clearStoredToken();
      }
      return null;
    }
  },

  async logout() {
    clearStoredToken();
  },
};
