import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { DEFAULT_COORDINATES, TILE_LAYERS } from '../utils/constants.js';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { mapService } from '../services/mapService.js';
import { historyService } from '../services/historyService.js';
import { toLatLng, toLeafletPoint, toGeoJSONPoint } from '../utils/coordinates.js';

const MapContext = createContext();

export function MapProvider({ children }) {
  const [mapInstance, setMapInstance] = useState(null);
  const [center, setCenter] = useState([DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon || DEFAULT_COORDINATES.lng]);
  const [zoom, setZoom] = useState(DEFAULT_COORDINATES.zoom);
  const [activeLayer, setActiveLayer] = useState(() => {
    try {
      const savedLayer = localStorage.getItem('terranav_map_layer');
      return savedLayer && TILE_LAYERS[savedLayer]?.available !== false ? savedLayer : 'osm';
    } catch {
      return 'osm';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('terranav_map_layer', activeLayer);
    } catch {
      // The map remains usable when browser storage is unavailable.
    }
  }, [activeLayer]);
  
  // Place & Route state
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [nearbyResults, setNearbyResults] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [nearbyError, setNearbyError] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((prev) => !prev), []);

  // Settings are persisted in localStorage; subscribe so mounted map panels
  // re-render immediately when a preference changes.
  const [, setSettingsRevision] = useState(0);
  useEffect(() => {
    const refreshSettings = () => setSettingsRevision(revision => revision + 1);
    window.addEventListener('terranav_settings_changed', refreshSettings);
    return () => window.removeEventListener('terranav_settings_changed', refreshSettings);
  }, []);

  // Smoothly invalidate Leaflet size when sidebar toggles
  useEffect(() => {
    if (!mapInstance) return undefined;
    mapInstance.invalidateSize({ pan: false });
    const t1 = setTimeout(() => mapInstance.invalidateSize({ pan: false }), 150);
    const t2 = setTimeout(() => mapInstance.invalidateSize({ pan: false }), 320);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isSidebarOpen, mapInstance]);

  // Live Geolocation hook
  const {
    location: userLocation,
    accuracy,
    loading: isLocating,
    error: locationError,
    isWatching: isTrackingLocation,
    permissionState,
    getCurrentLocation,
    startWatching: startLiveTracking,
    stopWatching: stopLiveTracking
  } = useGeolocation();

  // Fly to coordinate smoothly
  const flyToLocation = useCallback((lat, lng, targetZoom = 15) => {
    const pt = toLatLng(lat !== undefined && lng !== undefined ? { lat, lng } : lat);
    if (!pt) return;
    setCenter([pt.lat, pt.lng]);
    if (targetZoom) setZoom(targetZoom);
    if (mapInstance) {
      mapInstance.flyTo([pt.lat, pt.lng], targetZoom, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [mapInstance]);

  // Locate user and center map
  const locateUser = useCallback(async () => {
    try {
      const coords = await getCurrentLocation({ enableHighAccuracy: true, timeout: 10000 });
      if (coords?.lat && coords?.lng) {
        flyToLocation(coords.lat, coords.lng, 16);
        startLiveTracking();
      }
      return coords;
    } catch (err) {
      console.warn('Geolocation error:', err.message);
      throw err;
    }
  }, [getCurrentLocation, flyToLocation, startLiveTracking]);

  // Automatically request live location permission on app initialization
  useEffect(() => {
    let mounted = true;
    const requestInitialLocation = async () => {
      try {
        const coords = await getCurrentLocation({ enableHighAccuracy: true, timeout: 10000 });
        if (mounted && coords?.lat && coords?.lng) {
          flyToLocation(coords.lat, coords.lng, 15);
          startLiveTracking();
        }
      } catch (err) {
        console.info('Initial location request prompt dismissed or unavailable:', err.message);
      }
    };

    requestInitialLocation();

    return () => {
      mounted = false;
    };
  }, [getCurrentLocation, startLiveTracking, flyToLocation]);

  // Select place and open details
  const selectPlace = useCallback((place) => {
    setSelectedPlace(place);
    const pt = toLatLng(place);
    if (pt) {
      flyToLocation(pt.lat, pt.lng, 16);
    }
    if (place?.name) {
      historyService.recordSearch(place.name, place);
    }
  }, [flyToLocation]);

  // Execute nearby amenities search around current map center or location
  const searchNearby = useCallback(async (categoryId) => {
    setNearbyResults([]);
    setNearbyError(null);
    setSearchResults([]);
    setSelectedPlace(null);
    try {
      setIsSearchingNearby(true);
      setActiveCategory(categoryId);

      // Determine center: map center or user location
      let lat = center[0];
      let lng = center[1];
      if (mapInstance) {
        const mapCenter = mapInstance.getCenter();
        lat = mapCenter.lat;
        lng = mapCenter.lng;
      }

      const places = await mapService.getNearby(categoryId, lat, lng);
      setNearbyResults(places);

      // If results found, fit bounds to show all markers nicely
      if (places.length > 0 && mapInstance && window.L) {
        const points = places.map(p => toLeafletPoint(p)).filter(Boolean);
        if (points.length > 0) {
          const bounds = window.L.latLngBounds(points);
          mapInstance.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        }
      }

      return places;
    } catch (err) {
      console.error('Nearby search failed:', err);
      setNearbyResults([]);
      setNearbyError(err.message || 'Nearby places are temporarily unavailable.');
      return [];
    } finally {
      setIsSearchingNearby(false);
    }
  }, [center, mapInstance]);

  const clearNearbyResults = useCallback(() => {
    setNearbyResults([]);
    setActiveCategory(null);
    setNearbyError(null);
  }, []);

  // Clear all active search / nearby / route states
  const clearSelection = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  const clearRoute = useCallback(() => {
    setRouteData(null);
    setSelectedRouteId(null);
  }, []);

  const setActiveRoute = useCallback((routeId) => {
    setSelectedRouteId(routeId);
    setRouteData((current) => current ? { ...current, selectedRouteId: routeId } : current);
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
    setNearbyResults([]);
    setActiveCategory(null);
  }, []);

  return (
    <MapContext.Provider
      value={{
        mapInstance,
        setMapInstance,
        center,
        setCenter,
        zoom,
        setZoom,
        activeLayer,
        setActiveLayer: (layerId) => {
          if (TILE_LAYERS[layerId]?.available === false) return;
          setActiveLayer(TILE_LAYERS[layerId] ? layerId : 'osm');
        },
        tileConfig: TILE_LAYERS[activeLayer] || TILE_LAYERS.osm,
        selectedPlace,
        setSelectedPlace,
        selectPlace,
        clearSelection,
        searchResults,
        setSearchResults,
        nearbyResults,
        setNearbyResults,
        activeCategory,
        nearbyError,
        isSearchingNearby,
        searchNearby,
        clearNearbyResults,
        clearSearchResults,
        routeData,
        setRouteData: (data) => {
          setRouteData(data);
          setSelectedRouteId(data?.selectedRouteId || data?.routes?.[0]?.routeId || data?.routes?.[0]?.id || null);
        },
        selectedRouteId,
        setActiveRoute,
        clearRoute,
        userLocation,
        currentLocation: userLocation, // Compatibility alias
        accuracy,
        isLocating,
        locationError,
        permissionState,
        isTrackingLocation,
        locateUser,
        startLiveTracking,
        stopLiveTracking,
        flyToLocation,
        isSidebarOpen,
        setIsSidebarOpen,
        toggleSidebar,
        toLatLng,
        toLeafletPoint,
        toGeoJSONPoint,
      }}
    >
      {children}
    </MapContext.Provider>
  );
}

export function useMap() {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMap must be used within MapProvider');
  return context;
}
