const STORAGE_KEY = 'yildiz_location';

export const PRESET_CITIES = [
  { name: 'İstanbul',  lat: 41.0082,  lng:  28.9784 },
  { name: 'Ankara',    lat: 39.9334,  lng:  32.8597 },
  { name: 'İzmir',     lat: 38.4237,  lng:  27.1428 },
  { name: 'Berlin',    lat: 52.5200,  lng:  13.4050 },
  { name: 'London',    lat: 51.5074,  lng:  -0.1278 },
  { name: 'New York',  lat: 40.7128,  lng: -74.0060 },
  { name: 'Tokyo',     lat: 35.6762,  lng: 139.6503 },
  { name: 'Sydney',    lat: -33.8688, lng: 151.2093 },
  { name: 'Reykjavik', lat: 64.1355,  lng: -21.8954 },
];

/**
 * Request browser geolocation. Rejects with a human-readable message on failure.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function requestGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        const msgs = {
          1: 'Location access denied. Choose a city or enter coordinates.',
          2: 'Location unavailable. Choose a city or enter coordinates.',
          3: 'Location request timed out. Choose a city or enter coordinates.',
        };
        reject(new Error(msgs[err.code] || 'Location error.'));
      },
      { timeout: 12000, maximumAge: 300000 }
    );
  });
}

/** @param {{ lat: number, lng: number, name: string }} loc */
export function saveLocation(loc) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(loc)); } catch {}
}

/** @returns {{ lat: number, lng: number, name: string } | null} */
export function loadSavedLocation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return null;
    return d;
  } catch {
    return null;
  }
}

export function formatCoords(lat, lng) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lng).toFixed(2)}°${ew}`;
}
