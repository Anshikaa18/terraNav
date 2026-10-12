import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from '../../context/MapContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { TILE_LAYERS, DEFAULT_COORDINATES } from '../../utils/constants.js';
import { mapService } from '../../services/mapService.js';
import { toLeafletPoint, toLatLng, isValidLatLng } from '../../utils/coordinates.js';
import MapControls from './MapControls.jsx';

// Generate custom SVG DivIcon for places
function createPlaceIcon(category = 'place', isSelected = false) {
  let bgColor = isSelected ? '#ff5d61' : '#63e7ee';
  let glowColor = isSelected ? 'rgba(255, 93, 97, 0.7)' : 'rgba(99, 231, 238, 0.7)';
  let size = isSelected ? 36 : 28;

  const svg = `
    <div style="
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${size}px;
      height: ${size}px;
      background: ${bgColor};
      border: 2px solid #090c0f;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 0 12px ${glowColor};
      cursor: pointer;
      transition: transform 0.2s ease;
    ">
      <div style="
        width: ${size / 3.2}px;
        height: ${size / 3.2}px;
        background: #090c0f;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `;

  return L.divIcon({
    className: 'tactical-map-marker',
    html: svg,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Generate animated pulsing icon for current user location
function createCurrentLocationIcon() {
  const html = `
    <div class="relative flex items-center justify-center w-8 h-8 pointer-events-none">
      <div class="absolute w-8 h-8 rounded-full bg-[#63e7ee]/25 animate-pulse-ring"></div>
      <div class="w-3.5 h-3.5 rounded-full bg-[#63e7ee] border-2 border-white shadow-[0_0_12px_#63e7ee]"></div>
    </div>
  `;
  return L.divIcon({
    className: 'current-location-marker',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const userLocationLayerRef = useRef(null);

  const {
    setMapInstance,
    center,
    zoom,
    activeLayer,
    setActiveLayer,
    selectedPlace,
    selectPlace,
    searchResults,
    nearbyResults,
    routeData,
    userLocation,
    currentLocation,
  } = useMap();

  const { theme } = useTheme();

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLayer = theme === 'dark' ? TILE_LAYERS.dark : TILE_LAYERS.osm;
    if (theme === 'dark') {
      setActiveLayer('dark');
    }

    const initCenter = toLeafletPoint(center) || [DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon || DEFAULT_COORDINATES.lng];

    const map = L.map(mapContainerRef.current, {
      center: initCenter,
      zoom: zoom || DEFAULT_COORDINATES.zoom,
      zoomControl: false,
      attributionControl: true,
    });

    const tileLayer = L.tileLayer(initialLayer.url, {
      attribution: initialLayer.attribution,
      maxZoom: initialLayer.maxZoom,
      subdomains: initialLayer.subdomains || 'abcd',
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Feature group layers
    markersLayerRef.current = L.featureGroup().addTo(map);
    routeLayerRef.current = L.featureGroup().addTo(map);
    userLocationLayerRef.current = L.layerGroup().addTo(map);

    // Map Click: reverse geocode to select location
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      try {
        const place = await mapService.getPlaceDetails({ lat, lng, lon: lng });
        if (place) {
          selectPlace(place);
        }
      } catch (err) {
        console.warn('Reverse geocode on map click failed:', err.message);
      }
    });

    mapRef.current = map;
    setMapInstance(map);

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Synchronize active layer when theme is toggled
  useEffect(() => {
    if (!mapRef.current) return;
    if (theme === 'dark' && activeLayer === 'osm') {
      setActiveLayer('dark');
    } else if (theme === 'light' && activeLayer === 'dark') {
      setActiveLayer('osm');
    }
  }, [theme]);

  // Update Tile Layer when activeLayer changes
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;

    const layerConfig = TILE_LAYERS[activeLayer] || TILE_LAYERS.osm;
    if (layerConfig.subdomains && tileLayerRef.current.options) {
      tileLayerRef.current.options.subdomains = layerConfig.subdomains;
    }
    tileLayerRef.current.setUrl(layerConfig.url);
  }, [activeLayer]);

  // Update Live User Location Marker
  useEffect(() => {
    if (!mapRef.current || !userLocationLayerRef.current) return;

    userLocationLayerRef.current.clearLayers();

    const activeLoc = userLocation || currentLocation;
    const pt = toLatLng(activeLoc);

    if (pt) {
      const locMarker = L.marker([pt.lat, pt.lng], {
        icon: createCurrentLocationIcon(),
        zIndexOffset: 1000,
      });

      locMarker.bindTooltip(
        `<div class="font-mono text-xs text-[#63e7ee] font-semibold py-0.5 px-1">CURRENT GPS POSITION</div>`,
        { direction: 'top', offset: [0, -16] }
      );

      userLocationLayerRef.current.addLayer(locMarker);

      // Add accuracy circle if accuracy is known and reasonable (< 3000m)
      const acc = activeLoc?.accuracy;
      if (acc && acc > 0 && acc < 3000) {
        const circle = L.circle([pt.lat, pt.lng], {
          radius: acc,
          color: '#3b82f6',
          weight: 1,
          opacity: 0.4,
          fillColor: '#60a5fa',
          fillOpacity: 0.1,
        });
        userLocationLayerRef.current.addLayer(circle);
      }
    }
  }, [userLocation, currentLocation]);

  // Update Markers (SearchResults, NearbyResults, SelectedPlace)
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    // If an active route is showing, avoid cluttering the map with unrelated place pins
    const isRouteActive = Boolean(routeData?.routes && routeData.routes.length > 0);

    const placesToShow = [];

    // Search results markers
    if (searchResults && searchResults.length > 0) {
      placesToShow.push(...searchResults);
    }

    // Nearby results markers
    if (nearbyResults && nearbyResults.length > 0) {
      placesToShow.push(...nearbyResults);
    }

    // Add selected place if not already in list and no route is active
    if (selectedPlace && !isRouteActive && !placesToShow.some(p => p.id === selectedPlace.id)) {
      placesToShow.push(selectedPlace);
    }

    placesToShow.forEach((place) => {
      const pt = toLatLng(place);
      if (!pt) return;

      const isSelected = selectedPlace && selectedPlace.id === place.id;
      const marker = L.marker([pt.lat, pt.lng], {
        icon: createPlaceIcon(place.category, isSelected),
        zIndexOffset: isSelected ? 500 : 100,
      });

      marker.on('click', () => {
        selectPlace(place);
      });

      marker.bindTooltip(
        `<div class="font-medium text-xs py-0.5 px-1">${place.name}</div>`,
        { direction: 'top', offset: [0, -28] }
      );

      markersLayerRef.current.addLayer(marker);
    });
  }, [searchResults, nearbyResults, selectedPlace, selectPlace, routeData]);

  // Update Route Polyline & Endpoints
  useEffect(() => {
    if (!mapRef.current || !routeLayerRef.current) return;

    routeLayerRef.current.clearLayers();

    if (!routeData || !routeData.routes || routeData.routes.length === 0) return;

    const primaryRoute = routeData.routes[0];
    if (!primaryRoute.coordinates || primaryRoute.coordinates.length === 0) return;

    // Convert coordinates to standard Leaflet points
    const leafletCoords = primaryRoute.coordinates.map(c => toLeafletPoint(c)).filter(Boolean);
    if (leafletCoords.length < 2) return;

    // Background border casing for polyline for high contrast
    const casing = L.polyline(leafletCoords, {
      color: '#090c0f',
      weight: 8,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    });
    routeLayerRef.current.addLayer(casing);

    // If chunkflow chunks with congestion colors are present, render multi-color segments along the road
    const chunks = routeData.chunks || primaryRoute.chunks;
    if (chunks && chunks.length > 0) {
      chunks.forEach(chunk => {
        if (chunk.coordinates && chunk.coordinates.length > 0) {
          const chunkPoints = chunk.coordinates.map(c => toLeafletPoint(c)).filter(Boolean);
          if (chunkPoints.length >= 2) {
            const chunkPoly = L.polyline(chunkPoints, {
              color: chunk.color || '#62eef6',
              weight: 5,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            });
            chunkPoly.bindTooltip(
              `<div class="font-mono text-xs"><b>${chunk.chunkId}</b>: ${chunk.predictedSpeedKmh || 40} km/h (${(chunk.congestionLevel || 'normal').toUpperCase()})</div>`,
              { direction: 'top', sticky: true }
            );
            routeLayerRef.current.addLayer(chunkPoly);
          }
        }
      });
    } else {
      // Foreground active polyline in cyber cyan
      const polyline = L.polyline(leafletCoords, {
        color: '#62eef6',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
      });
      routeLayerRef.current.addLayer(polyline);
    }

    // Start point pin (tactical green ORIGIN)
    const startCoord = leafletCoords[0];
    const startPin = L.circleMarker(startCoord, {
      radius: 8,
      fillColor: '#61dfab',
      color: '#090c0f',
      weight: 2.5,
      fillOpacity: 1,
      zIndexOffset: 800,
    }).bindTooltip('ORIGIN', { permanent: false, direction: 'top', className: 'font-mono text-[10px]' });

    // End point pin (tactical red DESTINATION)
    const endCoord = leafletCoords[leafletCoords.length - 1];
    const endPin = L.circleMarker(endCoord, {
      radius: 9,
      fillColor: '#ff5d61',
      color: '#090c0f',
      weight: 2.5,
      fillOpacity: 1,
      zIndexOffset: 800,
    }).bindTooltip('DESTINATION', { permanent: false, direction: 'top', className: 'font-mono text-[10px]' });

    routeLayerRef.current.addLayer(startPin);
    routeLayerRef.current.addLayer(endPin);

    // Auto-fit route in viewport with margin
    const bounds = L.latLngBounds(leafletCoords);
    mapRef.current.fitBounds(bounds, {
      paddingTopLeft: [70, 70],
      paddingBottomRight: [70, 70],
      maxZoom: 16,
    });
  }, [routeData]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <MapControls />
    </div>
  );
}
