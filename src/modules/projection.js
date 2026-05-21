/**
 * Stereographic projection, zenith-centered.
 *
 * Sky convention: North = up, East = LEFT (you're looking UP at the sky, not down at a map).
 * Azimuth is degrees clockwise from North.
 *
 * Stereographic formula: r = horizonR * tan(zenithDist / 2)
 *   zenithDist=0  (zenith)  → r=0 (center)
 *   zenithDist=90 (horizon) → r=horizonR * tan(45°) = horizonR
 *
 * Stars with altitude ≤ -CULL_DEG are returned as null (skip drawing).
 */

const DEG = Math.PI / 180;
const CULL_ALTITUDE = -1; // degrees; draw stars just at the horizon line

/**
 * @param {number} altitude  degrees above horizon (-90 to 90)
 * @param {number} azimuth   degrees clockwise from North (0–360)
 * @param {number} cx        canvas center x
 * @param {number} cy        canvas center y
 * @param {number} horizonR  pixel radius for the horizon circle
 * @returns {{ x: number, y: number } | null}
 */
export function project(altitude, azimuth, cx, cy, horizonR) {
  if (altitude < CULL_ALTITUDE) return null;

  const zenithDist = (90 - altitude) * DEG;
  const r = horizonR * Math.tan(zenithDist / 2);
  const azRad = azimuth * DEG;

  return {
    x: cx - r * Math.sin(azRad),
    y: cy - r * Math.cos(azRad),
  };
}

/**
 * Inverse projection: screen pixel → approximate Alt/Az.
 * Used for hover/click identification.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} cx
 * @param {number} cy
 * @param {number} horizonR
 * @returns {{ altitude: number, azimuth: number }}
 */
export function unproject(x, y, cx, cy, horizonR) {
  // East is left, so dx = cx - x (not x - cx)
  const dx = cx - x;
  const dy = cy - y;
  const r = Math.sqrt(dx * dx + dy * dy);

  const zenithDistRad = 2 * Math.atan(r / horizonR);
  const altitude = 90 - zenithDistRad / DEG;
  const azimuth = ((Math.atan2(dx, dy) / DEG) + 360) % 360;

  return { altitude, azimuth };
}

/**
 * Compute canvas center and horizon radius for a given viewport size.
 * Leaves ~8% padding so the horizon circle doesn't touch the edge.
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ cx: number, cy: number, horizonR: number }}
 */
export function skyLayout(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const horizonR = Math.min(width, height) * 0.46;
  return { cx, cy, horizonR };
}
