export { toLatLng, toLeafletPoint, toGeoJSONPoint, isValidLatLng } from './coordinates.js';
import { toLatLng } from './coordinates.js';

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 */
export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const pt1 = toLatLng(lat1 !== undefined && lon1 !== undefined ? { lat: lat1, lng: lon1 } : lat1);
  const pt2 = toLatLng(lat2 !== undefined && lon2 !== undefined ? { lat: lat2, lng: lon2 } : lat2);
  if (!pt1 || !pt2) return 0;

  const R = 6371; // km
  const dLat = (pt2.lat - pt1.lat) * (Math.PI / 180);
  const dLon = (pt2.lng - pt1.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(pt1.lat * (Math.PI / 180)) * Math.cos(pt2.lat * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(km, unit = 'km') {
  if (km === undefined || km === null || isNaN(km)) return '';
  if (unit === 'miles') {
    const miles = km * 0.621371;
    if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
    return `${miles.toFixed(1)} mi`;
  }
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours} hr ${remMinutes > 0 ? remMinutes + ' min' : ''}`.trim();
}

export function formatCoordinates(lat, lon) {
  const pt = toLatLng(lat !== undefined && lon !== undefined ? { lat, lng: lon } : lat);
  if (!pt) return '';
  const latDir = pt.lat >= 0 ? 'N' : 'S';
  const lonDir = pt.lng >= 0 ? 'E' : 'W';
  return `${Math.abs(pt.lat).toFixed(4)}° ${latDir}, ${Math.abs(pt.lng).toFixed(4)}° ${lonDir}`;
}

/**
 * Format a Nominatim `address` object the way Indian addresses are normally read:
 * locality, city, state – PIN. Nominatim's own `display_name` is a long global
 * chain ("... , Bengaluru Central City Corporation, Bengaluru Urban, Karnataka,
 * 560001, India") which is accurate but unreadable in a compact card.
 *
 * Falls back to whichever fields exist, so partially-tagged rural places still
 * render something useful rather than an empty string.
 */
export function formatIndianAddress(address) {
  if (!address || typeof address !== 'object') return '';

  const locality = address.suburb || address.neighbourhood || address.village || address.town || null;
  const city = address.city || address.municipality || address.state_district || address.county || null;
  const state = address.state || null;
  const pin = address.postcode || null;

  // Avoid "Indiranagar, Indiranagar" when Nominatim repeats a name across fields.
  const parts = [locality, city, state].filter(Boolean);
  const deduped = parts.filter((part, idx) => parts.indexOf(part) === idx);

  const line = deduped.join(', ');
  if (line && pin) return `${line} – ${pin}`;
  return line || pin || '';
}

export function getCategoryBadge(category, type) {
  const cat = (category || type || '').toLowerCase();

  // India-specific categories are checked before the generic ones below, because
  // a metro station also matches "station" and a temple also matches nothing else.
  if (cat.includes('subway') || cat === 'metro') {
    return { name: 'Metro', color: 'bg-violet-600 text-white', icon: 'TrainFront' };
  }
  if (cat.includes('railway') || cat.includes('halt') || cat === 'station') {
    return { name: 'Railway', color: 'bg-slate-600 text-white', icon: 'Train' };
  }
  if (cat.includes('bus')) {
    return { name: 'Bus', color: 'bg-cyan-600 text-white', icon: 'Bus' };
  }
  if (cat.includes('pharmacy') || cat.includes('chemist')) {
    return { name: 'Pharmacy', color: 'bg-teal-600 text-white', icon: 'Pill' };
  }
  if (cat.includes('place_of_worship') || cat.includes('temple') || cat.includes('mandir')) {
    return { name: 'Temple', color: 'bg-orange-700 text-white', icon: 'Church' };
  }
  if (cat.includes('mall') || cat.includes('marketplace') || cat.includes('market')) {
    return { name: 'Market', color: 'bg-fuchsia-600 text-white', icon: 'ShoppingBag' };
  }
  if (cat.includes('police')) {
    return { name: 'Police', color: 'bg-blue-800 text-white', icon: 'Shield' };
  }

  if (cat.includes('restaurant') || cat.includes('food') || cat.includes('fast_food')) {
    return { name: 'Restaurant', color: 'bg-orange-500 text-white', icon: 'Utensils' };
  }
  if (cat.includes('cafe') || cat.includes('coffee')) {
    return { name: 'Cafe', color: 'bg-amber-600 text-white', icon: 'Coffee' };
  }
  if (cat.includes('hospital') || cat.includes('clinic') || cat.includes('doctor')) {
    return { name: 'Health', color: 'bg-red-500 text-white', icon: 'HeartPulse' };
  }
  if (cat.includes('bank') || cat.includes('atm')) {
    return { name: 'Finance', color: 'bg-emerald-600 text-white', icon: 'Landmark' };
  }
  if (cat.includes('hotel') || cat.includes('motel') || cat.includes('lodging') || cat.includes('guest_house')) {
    return { name: 'Lodging', color: 'bg-indigo-600 text-white', icon: 'Bed' };
  }
  if (cat.includes('fuel') || cat.includes('petrol') || cat.includes('gas')) {
    return { name: 'Petrol Pump', color: 'bg-blue-600 text-white', icon: 'Fuel' };
  }
  if (cat.includes('university') || cat.includes('school') || cat.includes('college')) {
    return { name: 'Education', color: 'bg-purple-600 text-white', icon: 'GraduationCap' };
  }
  if (cat.includes('tourism') || cat.includes('attraction') || cat.includes('museum')) {
    return { name: 'Attraction', color: 'bg-pink-600 text-white', icon: 'Camera' };
  }
  return { name: category || 'Place', color: 'bg-slate-700 text-white', icon: 'MapPin' };
}
