/**
 * Validates astronomy-engine: Sirius from Istanbul at a fixed time.
 * Cross-check result with Stellarium.
 *
 * Run: node scripts/validate-astronomy.js
 */
import * as Astronomy from 'astronomy-engine';

const ISTANBUL = { lat: 41.0082, lng: 28.9784 };

// Sirius: RA 6.752481h, Dec -16.716116°
const SIRIUS_RA = 6.752481;
const SIRIUS_DEC = -16.716116;

// Test at 2026-05-21 22:00:00 UTC (midnight-ish in Istanbul)
const testDate = new Date('2026-05-21T22:00:00Z');

const observer = new Astronomy.Observer(ISTANBUL.lat, ISTANBUL.lng, 0);
const hor = Astronomy.Horizon(testDate, observer, SIRIUS_RA, SIRIUS_DEC, 'normal');

console.log(`Sirius from Istanbul at ${testDate.toISOString()}:`);
console.log(`  Altitude: ${hor.altitude.toFixed(4)}°`);
console.log(`  Azimuth:  ${hor.azimuth.toFixed(4)}°`);
console.log(`  Above horizon: ${hor.altitude > 0}`);
console.log('');
console.log('Cross-check: open Stellarium, set location to Istanbul (41.01°N 28.98°E),');
console.log(`set time to ${testDate.toISOString()}, find Sirius, verify Alt/Az match.`);

// Also check a few planets
for (const name of ['Venus', 'Mars', 'Jupiter', 'Saturn']) {
  try {
    const body = Astronomy.Body[name];
    const eq = Astronomy.Equator(body, testDate, observer, true, true);
    const ph = Astronomy.Horizon(testDate, observer, eq.ra, eq.dec, 'normal');
    console.log(`${name}: Alt=${ph.altitude.toFixed(2)}° Az=${ph.azimuth.toFixed(2)}° ${ph.altitude > 0 ? '(visible)' : '(below horizon)'}`);
  } catch (e) {
    console.warn(`${name}: error — ${e.message}`);
  }
}
