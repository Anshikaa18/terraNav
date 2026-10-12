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
  const [activeLayer, setActiveLayer] = useState('dark');
  
  // Place & Route state
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [nearbyResults, setNearbyResults] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [isSearchingNearby, setIsSearchingNearby] = useState(false);

  // Live Geolocation hook
  const {
    location: userLocation,
    accuracy,
    loading: isLocating,
    error: locationError,
    isWatching: isTrackingLocation,
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
      const coords = await getCurrentLocation();
      if (coords?.lat && coords?.lng) {
        flyToLocation(coords.lat, coords.lng, 16);
      }
      return coords;
    } catch (err) {
      console.warn('Geolocation error:', err.message);
      throw err;
    }
  }, [getCurrentLocation, flyToLocation]);

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
      throw err;
    } finally {
      setIsSearchingNearby(false);
    }
  }, [center, mapInstance]);

  // Clear all active search / nearby / route states
  const clearSelection = useCallback(() => {
    setSelectedPlace(null);
  }, []);

  const clearRoute = useCallback(() => {
    setRouteData(null);
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
        setActiveLayer,
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
        isSearchingNearby,
        searchNearby,
        clearSearchResults,
        routeData,
        setRouteData,
        clearRoute,
        userLocation,
        currentLocation: userLocation, // Compatibility alias
        accuracy,
        isLocating,
        locationError,
        isTrackingLocation,
        locateUser,
        startLiveTracking,
        stopLiveTracking,
        flyToLocation,
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
