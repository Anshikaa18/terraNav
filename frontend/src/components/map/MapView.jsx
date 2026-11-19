import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMap } from '../../context/MapContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { TILE_LAYERS, DEFAULT_COORDINATES } from '../../utils/constants.js';
import { mapService } from '../../services/mapService.js';
import { toLeafletPoint, toLatLng } from '../../utils/coordinates.js';
import { getTrafficStyle } from '../../utils/traffic.js';
import { formatDistance } from '../../utils/geo.js';
import MapControls from './MapControls.jsx';
import SegmentDetails from './SegmentDetails.jsx';

// Vibrant category badge colors matching Figma & img_10.png
const CATEGORY_COLORS = {
  restaurant: '#f97316',
  food: '#f97316',
  cafe: '#d97706',
  coffee: '#d97706',
  hospital: '#ef4444',
  clinic: '#ef4444',
  pharmacy: '#10b981',
  chemist: '#10b981',
  atm: '#0ea5e9',
  bank: '#0ea5e9',
  fuel: '#8b5cf6',
  petrol: '#8b5cf6',
  bus: '#eab308',
  police: '#1e40af'
};

function getPlaceColor(place) {
  const cat = (place?.category || place?.type || '').toLowerCase();
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (cat.includes(key)) return color;
  }
  return '#1677ff';
}

function createPlaceIcon(place, isSelected = false) {
  const isHospital =
    (place?.category || place?.type || '').toLowerCase().includes('hospital') ||
    (place?.name || '').toLowerCase().includes('hospital') ||
    (place?.tags?.amenity || '').toLowerCase().includes('hospital');

  if (isHospital) {
    const size = isSelected ? 24 : 19;
    return L.divIcon({
      className: 'custom-hospital-marker',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background: #dc2626;
          border: 2px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
          <svg width="${size * 0.5}" height="${size * 0.5}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  const color = isSelected ? '#ff5d61' : getPlaceColor(place);
  const size = isSelected ? 22 : 18;
  return L.divIcon({
    className: 'custom-poi-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      ">
        <span style="
          width: ${size * 0.35}px;
          height: ${size * 0.35}px;
          background: #ffffff;
          border-radius: 50%;
          display: block;
        "></span>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function createCurrentLocationIcon() {
  return L.divIcon({
    className: 'current-location-marker',
    html: `
      <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 24px; height: 24px; border-radius: 50%; background: #20c7c9; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <span style="width: 14px; height: 14px; border-radius: 50%; background: #1677ff; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(22,119,255,0.6);"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

export default function MapView() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const routeBaseRef = useRef(null);
  const segmentLayerRef = useRef(new Map());
  const chunkMarkersLayerRef = useRef(null);
  const userLocationLayerRef = useRef(null);
  const fittedRouteRef = useRef(null);

  const [selectedSegment, setSelectedSegment] = useState(null);
  const {
    setMapInstance,
    center,
    zoom,
    activeLayer,
    selectedPlace,
    selectPlace,
    searchResults,
    nearbyResults,
    routeData,
    selectedRouteId,
    userLocation,
    currentLocation
  } = useMap();

  const { theme } = useTheme();

  const activeRoute = useMemo(
    () =>
      routeData?.routes?.find(
        (route) => (route.routeId || route.id) === (selectedRouteId || routeData?.selectedRouteId)
      ) || routeData?.routes?.[0] || null,
    [routeData, selectedRouteId]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;

    if (mapContainerRef.current._leaflet_id) {
      delete mapContainerRef.current._leaflet_id;
    }

    // OSM is the neutral default in both app themes. A saved user selection is
    // applied below through activeLayer, independently of the UI theme.
    const initialLayer = TILE_LAYERS.osm;

    const map = L.map(mapContainerRef.current, {
      center: toLeafletPoint(center) || [DEFAULT_COORDINATES.lat, DEFAULT_COORDINATES.lon],
      zoom: zoom || DEFAULT_COORDINATES.zoom,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    });

    L.control.attribution({ position: 'bottomleft' }).addTo(map);

    tileLayerRef.current = L.tileLayer(initialLayer.url, {
      attribution: initialLayer.attribution,
      maxZoom: initialLayer.maxZoom,
      subdomains: initialLayer.subdomains || 'abcd'
    }).addTo(map);

    markersLayerRef.current = L.featureGroup().addTo(map);
    routeBaseRef.current = L.featureGroup().addTo(map);
    chunkMarkersLayerRef.current = L.featureGroup().addTo(map);
    userLocationLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', async (event) => {
      try {
        const place = await mapService.getPlaceDetails({
          lat: event.latlng.lat,
          lng: event.latlng.lng,
          lon: event.latlng.lng
        });
        if (place) selectPlace(place);
      } catch {
        /* Map stays usable when reverse geocoding fails */
      }
    });

    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(mapContainerRef.current);

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      segmentLayerRef.current.clear();
    };
  }, []);

  // Basemap selection is user-controlled and does not follow the app theme.
  useEffect(() => {
    const requested = TILE_LAYERS[activeLayer];
    const config = requested?.available === false ? TILE_LAYERS.osm : (requested || TILE_LAYERS.osm);
    if (tileLayerRef.current && config) {
      tileLayerRef.current.setUrl(config.url);
      tileLayerRef.current.options.maxZoom = config.maxZoom;
      tileLayerRef.current.options.attribution = config.attribution;
    }
  }, [activeLayer]);

  // User location marker
  useEffect(() => {
    if (!userLocationLayerRef.current) return;
    userLocationLayerRef.current.clearLayers();
    const location = userLocation || currentLocation;
    const point = toLatLng(location);
    if (!point) return;

    userLocationLayerRef.current.addLayer(
      L.marker([point.lat, point.lng], { icon: createCurrentLocationIcon(), zIndexOffset: 1000 })
    );

    // Only draw accuracy ring if high accuracy GPS (< 80m) to prevent huge circle obscuring map
    if (location?.accuracy > 0 && location.accuracy < 80) {
      userLocationLayerRef.current.addLayer(
        L.circle([point.lat, point.lng], {
          radius: location.accuracy,
          color: theme === 'dark' ? '#20c7c9' : '#1677ff',
          weight: 1.5,
          opacity: 0.5,
          fillOpacity: 0.08
        })
      );
    }
  }, [userLocation, currentLocation, theme]);

  // POI & Search Markers
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();
    const isRouteActive = Boolean(activeRoute);
    const places = [...(searchResults || []), ...(nearbyResults || [])];
    if (selectedPlace && !isRouteActive && !places.some((place) => place.id === selectedPlace.id)) {
      places.push(selectedPlace);
    }

    places.forEach((place) => {
      const point = toLatLng(place);
      if (!point) return;
      const marker = L.marker([point.lat, point.lng], {
        icon: createPlaceIcon(place, selectedPlace?.id === place.id),
        zIndexOffset: selectedPlace?.id === place.id ? 500 : 100
      });
      marker.on('click', () => selectPlace(place));
      marker.bindTooltip(place.name || place.display_name?.split(',')[0] || 'Location', {
        direction: 'top',
        offset: [0, -20],
        className: 'chunk-badge'
      });
      markersLayerRef.current.addLayer(marker);
    });
  }, [searchResults, nearbyResults, selectedPlace, selectPlace, activeRoute]);

  // Route Casing & Fitting
  useEffect(() => {
    if (!routeBaseRef.current) return;
    routeBaseRef.current.clearLayers();
    if (!activeRoute?.coordinates || activeRoute.coordinates.length < 2) return;

    const coords = activeRoute.coordinates;
    const casingColor = theme === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)';
    routeBaseRef.current.addLayer(
      L.polyline(coords, {
        color: casingColor,
        weight: 12,
        opacity: 0.96,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false
      })
    );

    // Origin marker (Green)
    routeBaseRef.current.addLayer(
      L.circleMarker(coords[0], {
        pane: 'markerPane',
        radius: 8,
        fillColor: '#10b981',
        color: '#ffffff',
        weight: 2.5,
        fillOpacity: 1,
        interactive: false
      })
    );

    // Destination marker (Red)
    routeBaseRef.current.addLayer(
      L.circleMarker(coords[coords.length - 1], {
        pane: 'markerPane',
        radius: 9,
        fillColor: '#ef4444',
        color: '#ffffff',
        weight: 2.5,
        fillOpacity: 1,
        interactive: false
      })
    );

    const routeKey = activeRoute.routeId || activeRoute.id;
    if (routeKey !== fittedRouteRef.current) {
      mapRef.current?.fitBounds(L.latLngBounds(coords), {
        paddingTopLeft: [76, 76],
        paddingBottomRight: [76, 156],
        maxZoom: 16
      });
      fittedRouteRef.current = routeKey;
    }
  }, [activeRoute, theme]);

  // Multi-colored ChunkFlow Segments & Division Points
  useEffect(() => {
    if (!mapRef.current) return;
    if (chunkMarkersLayerRef.current) chunkMarkersLayerRef.current.clearLayers();

    const segments = activeRoute?.segments || [];
    const next = new Map(
      segments.map((segment, index) => [String(segment.segmentId || segment.id || index), { segment, index }])
    );

    segmentLayerRef.current.forEach((layer, key) => {
      if (!next.has(key)) {
        mapRef.current.removeLayer(layer);
        segmentLayerRef.current.delete(key);
      }
    });

    next.forEach(({ segment, index }, key) => {
      const style = getTrafficStyle(segment);
      // Neutral means no verified segment-level traffic. Do not turn missing
      // data into the app's normal route color, which reads as a traffic claim.
      const color = style.color;

      const options = {
        color,
        weight: 8,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: style.trafficClass === 'unknown' ? '7 7' : null
      };

      const existing = segmentLayerRef.current.get(key);
      if (existing) {
        existing.setLatLngs(segment.coordinates);
        existing.setStyle(options);
        existing.off('click');
        existing.on('click', () => setSelectedSegment(segment));
      } else {
        const layer = L.polyline(segment.coordinates, options).addTo(mapRef.current);
        layer.on('click', () => setSelectedSegment(segment));
        layer.bindTooltip(
          `<strong>${segment.roadName || 'Segment'}</strong> • ${formatDistance((segment.lengthMeters || 0) / 1000)} (${style.label})`,
          { sticky: true, className: 'chunk-badge' }
        );
        segmentLayerRef.current.set(key, layer);
      }

      // A segment boundary is a provider maneuver/leg boundary, not a synthetic
      // distance chunk. Start/destination have their own prominent markers.
      if (index > 0 && segment.coordinates && segment.coordinates.length > 0 && chunkMarkersLayerRef.current) {
        const firstPt = segment.coordinates[0];
        chunkMarkersLayerRef.current.addLayer(
          L.circleMarker(firstPt, {
            radius: 3.5,
            fillColor: '#ffffff',
            color,
            weight: 2,
            fillOpacity: 1,
            interactive: false
          })
        );
      }
    });

    // This should only occur for malformed legacy responses. It is neutral and
    // dashed, never a colored traffic assertion.
    if (!next.size && activeRoute?.coordinates?.length >= 2) {
      const key = '__fallback__';
      const fallback = L.polyline(activeRoute.coordinates, {
        color: '#788488',
        weight: 8,
        opacity: 1,
        lineCap: 'round',
        dashArray: '7 7',
        interactive: false
      }).addTo(mapRef.current);
      segmentLayerRef.current.set(key, fallback);
    }
  }, [activeRoute?.segments, activeRoute?.coordinates, theme]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <MapControls />
      <SegmentDetails segment={selectedSegment} onClose={() => setSelectedSegment(null)} />
    </div>
  );
}
