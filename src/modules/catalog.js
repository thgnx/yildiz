/**
 * Loads and indexes the star catalog from public/data/stars.json.
 * Provides O(1) lookup by HR number.
 */

/** @type {Array} All stars sorted by magnitude (brightest first) */
let _stars = [];

/** @type {Map<number, object>} HR number → star object */
let _byHr = new Map();

/** @type {boolean} */
let _loaded = false;

/**
 * Fetch and index the star catalog. Call once at startup.
 * @returns {Promise<Array>} Array of star objects
 */
export async function loadCatalog() {
  if (_loaded) return _stars;

  const res = await fetch('/data/stars.json');
  if (!res.ok) throw new Error(`Failed to load star catalog: ${res.status}`);

  _stars = await res.json();
  _loaded = true;

  for (const star of _stars) {
    if (star.hr != null) _byHr.set(star.hr, star);
  }

  return _stars;
}

/**
 * All stars, sorted brightest-first (available after loadCatalog resolves).
 * @returns {Array}
 */
export function getStars() {
  return _stars;
}

/**
 * Lookup a star by HR catalog number. O(1).
 * @param {number} hr
 * @returns {object | undefined}
 */
export function getByHr(hr) {
  return _byHr.get(hr);
}

/**
 * Stars brighter than or equal to the given magnitude limit.
 * @param {number} magLimit
 * @returns {Array}
 */
export function getStarsByMag(magLimit) {
  return _stars.filter(s => s.mag <= magLimit);
}

// ─── Constellation catalog ────────────────────────────────────────────────────

/** @type {Array} */
let _constellations = [];
let _constellationsLoaded = false;

/**
 * Fetch constellation line + label data.
 * @returns {Promise<Array>}
 */
export async function loadConstellations() {
  if (_constellationsLoaded) return _constellations;

  const res = await fetch('/data/constellations.json');
  if (!res.ok) throw new Error(`Failed to load constellations: ${res.status}`);

  _constellations = await res.json();
  _constellationsLoaded = true;
  return _constellations;
}

export function getConstellations() {
  return _constellations;
}
