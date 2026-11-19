import axios from 'axios';
import { getStoredToken } from './tokenStorage.js';

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to attach JWT token if present in secure token storage
api.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors gracefully
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // AbortController is used by typeahead and directions requests. Preserve its
    // identity so callers can intentionally ignore obsolete responses.
    if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
      return Promise.reject(error);
    }
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred. Please try again.';
    const normalizedError = new Error(message);
    normalizedError.statusCode = error.response?.status || error.response?.data?.error?.statusCode;
    normalizedError.code = error.response?.data?.error?.details?.code || error.code;
    normalizedError.details = error.response?.data?.error?.details;
    return Promise.reject(normalizedError);
  }
);

export default api;
