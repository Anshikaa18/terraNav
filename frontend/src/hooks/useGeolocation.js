import { useState, useCallback, useEffect, useRef } from 'react';
import { toLatLng } from '../utils/geo.js';

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);

  const watchIdRef = useRef(null);

  const parsePosition = (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const acc = position.coords.accuracy;
    const parsed = {
      lat,
      lng,
      accuracy: acc,
      heading: position.coords.heading || null,
      speed: position.coords.speed || null,
      timestamp: position.timestamp,
    };
    return parsed;
  };

  const getErrorMessage = (err) => {
    if (err.code === err.PERMISSION_DENIED) {
      return 'Location access was denied. Please allow location permissions in your browser.';
    }
    if (err.code === err.POSITION_UNAVAILABLE) {
      return 'Location information is currently unavailable.';
    }
    if (err.code === err.TIMEOUT) {
      return 'Location request timed out. Please try again.';
    }
    return err.message || 'Unable to retrieve location';
  };

  // One-time fetch
  const getCurrentLocation = useCallback((options = {}) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const msg = 'Geolocation is not supported by your browser';
        setError(msg);
        reject(new Error(msg));
        return;
      }

      setLoading(true);
      setError(null);

      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
        ...options,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = parsePosition(position);
          setLocation(coords);
          setAccuracy(coords.accuracy);
          setLoading(false);
          setError(null);
          resolve(coords);
        },
        (err) => {
          const message = getErrorMessage(err);
          setError(message);
          setLoading(false);
          reject(new Error(message));
        },
        defaultOptions
      );
    });
  }, []);

  // Continuous watchPosition
  const startWatching = useCallback((options = {}) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    if (watchIdRef.current !== null) return; // Already watching

    const defaultOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 2000,
      ...options,
    };

    setIsWatching(true);
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords = parsePosition(position);
        setLocation(coords);
        setAccuracy(coords.accuracy);
        setError(null);
      },
      (err) => {
        const message = getErrorMessage(err);
        setError(message);
      },
      defaultOptions
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return {
    location,
    accuracy,
    loading,
    error,
    isWatching,
    getCurrentLocation,
    startWatching,
    stopWatching,
  };
}
