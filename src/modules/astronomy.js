import * as Astronomy from 'astronomy-engine';

/**
 * @typedef {{ altitude: number, azimuth: number }} HorizCoords
 * altitude: degrees above horizon (-90 to +90)
 * azimuth: degrees clockwise from north (0–360)
 */

/**
 * Convert equatorial coordinates to horizontal (Alt/Az) for a given observer and time.
 *
 * @param {number} ra   Right ascension in hours (J2000)
 * @param {number} dec  Declination in degrees (J2000)
 * @param {number} lat  Observer latitude in degrees
 * @param {number} lng  Observer longitude in degrees
 * @param {Date}   date UTC date/time
 * @returns {HorizCoords}
 */
export function raDecToAltAz(ra, dec, lat, lng, date) {
  const observer = new Astronomy.Observer(lat, lng, 0);
  const result = Astronomy.Horizon(date, observer, ra, dec, 'normal');
  return { altitude: result.altitude, azimuth: result.azimuth };
}

/**
 * Get current Alt/Az for a solar system body by name.
 * Body names: 'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'
 *
 * @param {string} bodyName
 * @param {number} lat
 * @param {number} lng
 * @param {Date}   date
 * @returns {HorizCoords}
 */
export function bodyAltAz(bodyName, lat, lng, date) {
  const observer = new Astronomy.Observer(lat, lng, 0);
  const body = Astronomy.Body[bodyName];
  const eq = Astronomy.Equator(body, date, observer, true, true);
  const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

/**
 * Get Alt/Az + magnitude for all visible planets.
 * @param {number} lat
 * @param {number} lng
 * @param {Date} date
 * @returns {Array<{ name: string, altitude: number, azimuth: number, mag: number }>}
 */
export function getPlanets(lat, lng, date) {
  const observer = new Astronomy.Observer(lat, lng, 0);
  return PLANETS.map(name => {
    const body = Astronomy.Body[name];
    const eq   = Astronomy.Equator(body, date, observer, true, true);
    const hor  = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
    const illum = Astronomy.Illumination(body, date);
    return { name, altitude: hor.altitude, azimuth: hor.azimuth, mag: illum.mag };
  });
}

/**
 * Get Moon position + phase.
 * @param {number} lat
 * @param {number} lng
 * @param {Date} date
 * @returns {{ altitude: number, azimuth: number, phaseDeg: number, illuminated: number }}
 */
export function getMoon(lat, lng, date) {
  const observer = new Astronomy.Observer(lat, lng, 0);
  const eq  = Astronomy.Equator(Astronomy.Body.Moon, date, observer, true, true);
  const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
  const phaseDeg = Astronomy.MoonPhase(date);
  const illum = Astronomy.Illumination(Astronomy.Body.Moon, date);
  return {
    altitude: hor.altitude,
    azimuth: hor.azimuth,
    phaseDeg,
    illuminated: illum.phase_fraction,
  };
}

/**
 * Get Sun position.
 * @param {number} lat
 * @param {number} lng
 * @param {Date} date
 * @returns {{ altitude: number, azimuth: number }}
 */
export function getSun(lat, lng, date) {
  const observer = new Astronomy.Observer(lat, lng, 0);
  const eq  = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
  const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}
