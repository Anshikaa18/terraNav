import { useState, useCallback, useEffect, useRef } from 'react';

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unknown'

  const watchIdRef = useRef(null);

  // Monitor browser geolocation permission state
  useEffect(() => {
    let mounted = true;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then((status) => {
          if (!mounted) return;
          setPermissionState(status.state);
          status.onchange = () => {
            if (mounted) setPermissionState(status.state);
          };
        })
        .catch(() => {
          if (mounted) setPermissionState('unknown');
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  const parsePosition = (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const acc = position.coords.accuracy;
    return {
      lat,
      lng,
      accuracy: acc,
      heading: position.coords.heading || null,
      speed: position.coords.speed || null,
      timestamp: position.timestamp,
    };
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

  // Helper for IP-based geolocation fallback when GPS / secure context is unavailable
  const getIpLocationFallback = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
          return {
            lat: data.latitude,
            lng: data.longitude,
            accuracy: 3000,
            city: data.city || 'Local area',
            isApproximate: true,
            source: 'ip'
          };
        }
      }
    } catch {
      // ignore network errors
    }
    return null;
  };

  // One-time fetch (triggers native browser permission dialog if state is 'prompt')
  const getCurrentLocation = useCallback((options = {}) => {
    return new Promise(async (resolve, reject) => {
      const isUnsecure = typeof window !== 'undefined' && window.isSecureContext === false;

      if (typeof navigator === 'undefined' || !navigator.geolocation || isUnsecure) {
        // Fall back to IP-based location gracefully
        const ipLocation = await getIpLocationFallback();
        if (ipLocation) {
          setLocation(ipLocation);
          setAccuracy(ipLocation.accuracy);
          setLoading(false);
          setError(null);
          setPermissionState('granted');
          resolve(ipLocation);
          return;
        }

        const msg = isUnsecure
          ? 'Secure HTTPS is required for GPS on network IPs. Using approximate default location.'
          : 'Geolocation is not supported by your browser';
        setError(msg);
        setPermissionState('denied');
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
          setPermissionState('granted');
          resolve(coords);
        },
        async (err) => {
          // Attempt IP location fallback on permission denied
          if (err.code === err.PERMISSION_DENIED || isUnsecure) {
            const ipLoc = await getIpLocationFallback();
            if (ipLoc) {
              setLocation(ipLoc);
              setAccuracy(ipLoc.accuracy);
              setLoading(false);
              setError(null);
              setPermissionState('granted');
              resolve(ipLoc);
              return;
            }
          }

          const message = getErrorMessage(err);
          setError(message);
          setLoading(false);
          if (err.code === err.PERMISSION_DENIED) {
            setPermissionState('denied');
          }
          reject(new Error(message));
        },
        defaultOptions
      );
    });
  }, []);

  // Continuous watchPosition
  const startWatching = useCallback((options = {}) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
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
        setPermissionState('granted');
      },
      (err) => {
        const message = getErrorMessage(err);
        setError(message);
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState('denied');
        }
      },
      defaultOptions
    );
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
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
    permissionState,
    getCurrentLocation,
    startWatching,
    stopWatching,
  };
}
