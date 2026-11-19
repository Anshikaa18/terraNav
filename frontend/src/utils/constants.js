// ChunkFlow is India-first: the map opens over Bengaluru and geocoding is biased
// to India by default, but worldwide places stay reachable (see INDIA_COUNTRY_CODE).
export const DEFAULT_COORDINATES = {
  lat: 21.2400,
  lon: 81.6350,
  city: 'Raipur',
  zoom: 14,
};

// Approximate bounding box of India [[southWest], [northEast]] — used to keep the
// initial view and "reset view" action inside the country.
export const INDIA_BOUNDS = [
  [6.5, 68.1],
  [35.7, 97.4],
];

// ISO 3166-1 alpha-2 code passed to Nominatim as `countrycodes`. Sending
// `country=all` to /api/places/search lifts the bias for worldwide searches.
export const INDIA_COUNTRY_CODE = 'in';

export const MAJOR_INDIAN_CITIES = [
  { name: 'Raipur', lat: 21.2400, lon: 81.6350 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Mumbai', lat: 19.0760, lon: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lon: 77.2090 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Hyderabad', lat: 17.3850, lon: 78.4867 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
];

// Helper to extract CARTO key from environment variables or custom URL
function getCartoKey() {
  const envDark = import.meta.env.VITE_MAP_DARK_TILE_URL?.trim() || '';
  const explicitKey = import.meta.env.VITE_CARTO_API_KEY?.trim() || import.meta.env.VITE_API_KEY?.trim() || '';
  if (explicitKey) return explicitKey;

  // Extract key or api_key parameter from VITE_MAP_DARK_TILE_URL if present
  if (envDark.includes('key=')) {
    const match = envDark.match(/[?&](?:api_)?key=([^&]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If user pasted just their raw key into VITE_MAP_DARK_TILE_URL
  if (envDark && !envDark.startsWith('http') && envDark.length > 10) {
    return envDark;
  }

  return '';
}

// Helper to resolve dark tile URL from environment or CARTO defaults
function resolveDarkTileUrl() {
  const envDark = import.meta.env.VITE_MAP_DARK_TILE_URL?.trim();
  const cartoKey = getCartoKey();

  if (envDark && envDark.includes('{z}') && envDark.includes('{x}') && envDark.includes('{y}')) {
    let cleanUrl = envDark.replace('{r}', '');
    // Ensure subdomain {s} exists for load balancing if using cartocdn
    if (cleanUrl.includes('basemaps.cartocdn.com') && !cleanUrl.includes('{s}')) {
      cleanUrl = cleanUrl.replace('basemaps.cartocdn.com', '{s}.basemaps.cartocdn.com');
    }
    return cleanUrl;
  }

  // If CARTO key is available, use official CARTO Dark Matter with key
  if (cartoKey) {
    return `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`;
  }

  // Watermark-free fallback if no CARTO key is present
  return 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
}

// Helper to resolve light/standard tile URL
function resolveStandardTileUrl() {
  const envTile = import.meta.env.VITE_MAP_TILE_URL?.trim();
  if (envTile && envTile.includes('{z}') && envTile.includes('{x}') && envTile.includes('{y}')) {
    return envTile.replace('{r}', '');
  }
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}

const activeCartoKey = getCartoKey();
const cartoKeyQuery = activeCartoKey ? `?key=${encodeURIComponent(activeCartoKey)}` : '';

export const TILE_LAYERS = {
  osm: {
    id: 'osm',
    name: 'Standard (OSM)',
    url: resolveStandardTileUrl(),
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: 'abc',
  },
  light: {
    id: 'light',
    name: 'CartoDB Positron',
    url: `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png${cartoKeyQuery}`,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  dark: {
    id: 'dark',
    name: 'CartoDB Dark Matter',
    url: resolveDarkTileUrl(),
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  voyager: {
    id: 'voyager',
    name: 'CartoDB Voyager',
    url: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png${cartoKeyQuery}`,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  tomtom: {
    id: 'tomtom',
    name: 'TomTom Maps',
    description: 'TomTom Basic raster map, securely proxied by the backend',
    // The backend owns TOMTOM_API_KEY, so it never becomes a browser-visible URL.
    url: '/api/maps/tomtom/tiles/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.tomtom.com/">TomTom</a> &copy; OpenStreetMap contributors',
    maxZoom: 22,
  },
};

export const NEARBY_CATEGORIES = [
  {
    id: 'restaurants', label: 'Restaurants', icon: 'Utensils', color: 'bg-orange-500',
    overpass: [['amenity', 'restaurant'], ['amenity', 'fast_food']],
    nominatim: 'restaurant', osmTypes: ['restaurant', 'fast_food'],
  },
  {
    id: 'cafes', label: 'Cafes', icon: 'Coffee', color: 'bg-amber-600',
    overpass: [['amenity', 'cafe']],
    nominatim: 'cafe', osmTypes: ['cafe'],
  },
  {
    id: 'hospitals', label: 'Hospitals', icon: 'HeartPulse', color: 'bg-red-500',
    overpass: [['amenity', 'hospital'], ['amenity', 'clinic']],
    nominatim: 'hospital', osmTypes: ['hospital', 'clinic'],
  },
  {
    id: 'pharmacy', label: 'Pharmacy', icon: 'Pill', color: 'bg-teal-600',
    overpass: [['amenity', 'pharmacy']],
    nominatim: 'pharmacy', osmTypes: ['pharmacy', 'chemist'],
  },
  {
    id: 'atms', label: 'ATMs', icon: 'Landmark', color: 'bg-emerald-600',
    overpass: [['amenity', 'atm'], ['amenity', 'bank']],
    nominatim: 'atm', osmTypes: ['atm', 'bank'],
  },
  {
    id: 'petrol', label: 'Petrol Pumps', icon: 'Fuel', color: 'bg-blue-600',
    overpass: [['amenity', 'fuel']],
    nominatim: 'petrol pump', osmTypes: ['fuel'],
  },
  {
    id: 'bus', label: 'Bus Stops', icon: 'Bus', color: 'bg-cyan-600',
    overpass: [['amenity', 'bus_station'], ['highway', 'bus_stop']],
    nominatim: 'bus stop', osmTypes: ['bus_station', 'bus_stop'],
  },
  {
    id: 'police', label: 'Police Stations', icon: 'Shield', color: 'bg-blue-800',
    overpass: [['amenity', 'police']],
    nominatim: 'police station', osmTypes: ['police'],
  },
  {
    id: 'hotels', label: 'Hotels', icon: 'Bed', color: 'bg-indigo-500',
    overpass: [['tourism', 'hotel'], ['tourism', 'guest_house']],
    nominatim: 'hotel', osmTypes: ['hotel', 'guest_house'],
  },
  {
    id: 'temples', label: 'Temples', icon: 'Church', color: 'bg-orange-700',
    overpass: [['amenity', 'place_of_worship']],
    nominatim: 'temple', osmTypes: ['place_of_worship'],
  },
  {
    id: 'malls', label: 'Malls & Markets', icon: 'ShoppingBag', color: 'bg-fuchsia-600',
    overpass: [['shop', 'mall'], ['amenity', 'marketplace']],
    nominatim: 'mall', osmTypes: ['mall', 'marketplace'],
  },
  {
    id: 'colleges', label: 'Colleges', icon: 'GraduationCap', color: 'bg-purple-600',
    overpass: [['amenity', 'college'], ['amenity', 'university']],
    nominatim: 'college', osmTypes: ['college', 'university'],
  },
  {
    id: 'attractions', label: 'Attractions', icon: 'Camera', color: 'bg-pink-500',
    overpass: [['tourism', 'attraction'], ['tourism', 'museum']],
    nominatim: 'tourist attraction', osmTypes: ['attraction', 'museum'],
  },
];

// `valhallaCosting` maps each UI mode to a Valhalla costing model. These are the
// real per-mode profiles — the previous OSRM demo server silently served the car
// profile for every mode, so walking and cycling returned driving times.
export const TRANSPORT_MODES = [
  { id: 'driving', label: 'Car', icon: 'Car', valhallaCosting: 'auto' },
  { id: 'motorcycle', label: 'Bike', icon: 'Motorcycle', valhallaCosting: 'motorcycle' },
  { id: 'bicycle', label: 'Bicycle', icon: 'Bicycle', valhallaCosting: 'bicycle' },
  { id: 'walking', label: 'Walk', icon: 'Footprints', valhallaCosting: 'pedestrian' },
];

export const DEFAULT_LISTS = [
  { id: 1, name: 'Favorites', icon: 'heart', color: 'text-rose-500' },
  { id: 2, name: 'Work', icon: 'briefcase', color: 'text-blue-500' },
  { id: 3, name: 'Travel', icon: 'plane', color: 'text-amber-500' },
];
