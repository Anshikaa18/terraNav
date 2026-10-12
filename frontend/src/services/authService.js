import api from './api.js';

export const authService = {
  async register(nameOrUsername, email, password) {
    const username = nameOrUsername ? nameOrUsername.trim().replace(/\s+/g, '_') : 'user_' + Date.now();
    const res = await api.post('/api/auth/register', { username, email, password });
    const payload = res.data || res;
    const token = payload.token;
    if (token) {
      localStorage.setItem('terranav_token', token);
      localStorage.setItem('terranav_jwt_token', token);
    }
    return payload;
  },

  async login(email, password) {
    const res = await api.post('/api/auth/login', { email, password });
    const payload = res.data || res;
    const token = payload.token;
    if (token) {
      localStorage.setItem('terranav_token', token);
      localStorage.setItem('terranav_jwt_token', token);
    }
    return payload;
  },

  async getMe() {
    const token = localStorage.getItem('terranav_jwt_token') || localStorage.getItem('terranav_token');
    if (!token) {
      return null;
    }
    try {
      const res = await api.get('/api/auth/me');
      const payload = res.data || res;
      return payload.user || payload;
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('terranav_token');
        localStorage.removeItem('terranav_jwt_token');
      }
      return null;
    }
  },

  async logout() {
    try {
      localStorage.removeItem('terranav_token');
      localStorage.removeItem('terranav_jwt_token');
    } catch {
      // Ignore errors on logout
    }
  },
};
