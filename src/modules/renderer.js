/**
 * Canvas drawing layer. All functions are pure — they take data and draw, no state stored here.
 * Call sequence: clear → drawBackground → drawHorizon → drawStars → drawCardinals
 */

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

// ─── Color helpers ────────────────────────────────────────────────────────────

/**
 * Map B-V color index to an RGB triple.
 * Scale: deep blue (B-V<0) → white (0.3) → yellow (0.8) → orange-red (>1.5)
 *
 * @param {number|null} bv
 * @returns {[number, number, number]}
 */
function bvToRgb(bv) {
  if (bv === null || bv === undefined || isNaN(bv)) return [242, 238, 230];

  const t = Math.max(-0.4, Math.min(2.0, bv));

  // Control points: [bv, r, g, b]
  const stops = [
    [-0.4, 147, 185, 255],   // hot blue-white (O/B)
    [ 0.0, 210, 225, 255],   // blue-white (A, like Sirius)
    [ 0.3, 242, 242, 255],   // white (F)
    [ 0.6, 255, 244, 214],   // yellow-white (G, like Sun)
    [ 1.0, 255, 210, 160],   // orange (K)
    [ 1.5, 255, 176, 100],   // orange-red (M)
    [ 2.0, 255, 130,  70],   // deep red (M giant)
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i];
    const [t1, r1, g1, b1] = stops[i + 1];
    if (t <= t1) {
      const n = (t - t0) / (t1 - t0);
      return [
        Math.round(r0 + (r1 - r0) * n),
        Math.round(g0 + (g1 - g0) * n),
        Math.round(b0 + (b1 - b0) * n),
      ];
    }
  }
  return [255, 130, 70];
}

/**
 * Magnitude → pixel radius.
 * Brightest star (Sirius, -1.44) → ~4.8px   naked-eye limit (6.5) → 0.5px
 *
 * @param {number} mag
 * @returns {number}
 */
function magToRadius(mag) {
  return Math.max(0.5, (6.5 - mag) * 0.62);
}

// ─── Drawing functions ────────────────────────────────────────────────────────

/**
 * Fill the canvas with deep-space background + subtle vignette.
 */
export function drawBackground(ctx, width, height, cx, cy, horizonR) {
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, width, height);

  // Very faint glow inside the sky dome — suggests sky depth
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, horizonR * 1.1);
  grad.addColorStop(0, 'rgba(10, 14, 28, 0)');
  grad.addColorStop(0.7, 'rgba(10, 14, 28, 0)');
  grad.addColorStop(1, 'rgba(4, 5, 8, 0.6)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw the horizon circle and a faint atmosphere band below it.
 */
export function drawHorizon(ctx, cx, cy, horizonR) {
  // Atmosphere glow — band just inside/outside the horizon
  const atmosGrad = ctx.createRadialGradient(cx, cy, horizonR * 0.88, cx, cy, horizonR * 1.05);
  atmosGrad.addColorStop(0, 'rgba(80, 120, 180, 0)');
  atmosGrad.addColorStop(0.5, 'rgba(60, 90, 140, 0.06)');
  atmosGrad.addColorStop(1, 'rgba(30, 50, 80, 0)');
  ctx.fillStyle = atmosGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR * 1.05, 0, TAU);
  ctx.fill();

  // Horizon line
  ctx.beginPath();
  ctx.arc(cx, cy, horizonR, 0, TAU);
  ctx.strokeStyle = 'rgba(168, 200, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Draw N / S / E / W labels at the horizon edge.
 * Sky convention: N top, E left, S bottom, W right.
 */
export function drawCardinals(ctx, cx, cy, horizonR) {
  const labels = [
    { text: 'N', az: 0 },
    { text: 'E', az: 90 },
    { text: 'S', az: 180 },
    { text: 'W', az: 270 },
  ];

  ctx.font = '400 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const { text, az } of labels) {
    const azRad = az * DEG;
    const sinA = Math.sin(azRad);
    const cosA = Math.cos(azRad);

    // Tick mark on the horizon circle
    const tickOuter = horizonR;
    const tickInner = horizonR - 8;
    ctx.beginPath();
    ctx.moveTo(cx - tickOuter * sinA, cy - tickOuter * cosA);
    ctx.lineTo(cx - tickInner * sinA, cy - tickInner * cosA);
    ctx.strokeStyle = 'rgba(168, 200, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label just inside the circle
    const labelR = horizonR - 22;
    const x = cx - labelR * sinA;
    const y = cy - labelR * cosA;

    ctx.fillStyle = 'rgba(168, 200, 255, 0.8)';
    ctx.fillText(text, x, y);
  }
}

/**
 * Draw altitude grid rings (optional, very faint).
 * Rings at 30° and 60° altitude.
 */
export function drawAltitudeRings(ctx, cx, cy, horizonR) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 0.5;
  ctx.setLineDash([4, 8]);

  for (const alt of [30, 60]) {
    const zenithDist = (90 - alt) * DEG;
    const r = horizonR * Math.tan(zenithDist / 2);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }

  ctx.setLineDash([]);
}

// ─── Constellation lines ──────────────────────────────────────────────────────

/**
 * Draw constellation line segments.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<[x1,y1,x2,y2]>} segments  Pre-projected screen coordinate segments
 */
export function drawConstellationLines(ctx, segments) {
  if (!segments.length) return;
  ctx.strokeStyle = 'rgba(168, 200, 255, 0.18)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of segments) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
}

/**
 * Draw constellation name labels.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ name: string, tr: string, x: number, y: number }>} labels
 * @param {boolean} showTr  show Turkish names in parens
 */
export function drawConstellationLabels(ctx, labels, showTr = true) {
  ctx.font = 'italic 400 11px Fraunces, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const { name, tr, x, y } of labels) {
    const text = showTr && tr && tr !== name ? `${name} (${tr})` : name;
    ctx.fillStyle = 'rgba(168, 200, 255, 0.35)';
    ctx.fillText(text, x, y);
  }
}

// ─── Planets ──────────────────────────────────────────────────────────────────

const PLANET_COLORS = {
  Mercury: [180, 180, 170],
  Venus:   [255, 248, 210],
  Mars:    [255, 160, 100],
  Jupiter: [230, 210, 180],
  Saturn:  [220, 200, 150],
};

/**
 * Draw planets as glowing discs with labels.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ name: string, x: number, y: number, mag: number }>} planets
 */
export function drawPlanets(ctx, planets) {
  for (const { name, x, y, mag } of planets) {
    const [r, g, b] = PLANET_COLORS[name] || [255, 255, 255];
    const radius = Math.max(2, (5 - mag) * 0.7);

    // Halo
    const haloR = radius * 4;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    halo.addColorStop(0, `rgba(${r},${g},${b},0.25)`);
    halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, TAU);
    ctx.fill();

    // Disc
    ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    // Label
    ctx.font = '400 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(${r},${g},${b},0.7)`;
    ctx.fillText(name, x, y + radius + 10);
  }
}

// ─── Moon ─────────────────────────────────────────────────────────────────────

/**
 * Draw the Moon with a phase-correct terminator.
 * Uses bezier approximation of the elliptical terminator.
 *
 * phaseDeg: 0=new, 90=first quarter, 180=full, 270=last quarter
 */
export function drawMoon(ctx, x, y, radius, phaseDeg) {
  const phase    = ((phaseDeg % 360) + 360) % 360;
  const phaseRad = phase * DEG;
  const litFrac  = (1 - Math.cos(phaseRad)) / 2;
  const k        = 0.5522847498; // bezier circle constant
  const R        = radius;

  ctx.save();
  ctx.translate(x, y);

  // Glow halo
  const glow = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R * 3);
  glow.addColorStop(0, 'rgba(215, 210, 170, 0.12)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, R * 3, 0, TAU); ctx.fill();

  // Dark disc
  ctx.fillStyle = '#0c0d14';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();

  if (litFrac > 0.005) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();

    const LIT = 'rgba(232, 222, 182, 0.94)';

    if (litFrac > 0.995) {
      ctx.fillStyle = LIT;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
    } else {
      // bowX: signed x of terminator at the equator
      // For waxing (0-180): bowX = R*cos(phase) → + is crescent, - is gibbous
      // For waning (180-360): flip sign so the shape mirrors correctly
      const bowX = phase <= 180
        ? R * Math.cos(phaseRad)
        : -R * Math.cos(phaseRad);
      const ew = Math.abs(bowX); // ellipse semi-axis

      ctx.fillStyle = LIT;
      ctx.beginPath();
      ctx.moveTo(0, -R);

      if (phase <= 180) {
        // Lit right side
        ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, false);
        ctx.lineTo(0, R);
        if (bowX >= 0) {
          // Crescent: return via right half of terminator ellipse
          ctx.bezierCurveTo( ew * k, R,  ew, R * k,  ew, 0);
          ctx.bezierCurveTo( ew, -R * k,  ew * k, -R, 0, -R);
        } else {
          // Gibbous: return via left half of terminator ellipse (extends lit area left)
          ctx.bezierCurveTo(-ew * k, R, -ew, R * k, -ew, 0);
          ctx.bezierCurveTo(-ew, -R * k, -ew * k, -R, 0, -R);
        }
      } else {
        // Lit left side
        ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2, true);
        ctx.lineTo(0, R);
        if (bowX <= 0) {
          // Crescent: return via left half of terminator ellipse
          ctx.bezierCurveTo(-ew * k, R, -ew, R * k, -ew, 0);
          ctx.bezierCurveTo(-ew, -R * k, -ew * k, -R, 0, -R);
        } else {
          // Gibbous: return via right half
          ctx.bezierCurveTo( ew * k, R,  ew, R * k,  ew, 0);
          ctx.bezierCurveTo( ew, -R * k,  ew * k, -R, 0, -R);
        }
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore(); // clip
  }

  // Rim
  ctx.strokeStyle = 'rgba(200, 190, 155, 0.22)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();

  // Label
  ctx.font = '400 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(215, 210, 170, 0.65)';
  ctx.fillText('Moon', 0, R + 12);

  ctx.restore();
}

// ─── Sun ─────────────────────────────────────────────────────────────────────

/**
 * Draw Sun (when above horizon — daytime or twilight).
 */
export function drawSun(ctx, x, y) {
  const R = 8;

  // Outer glow
  const glow = ctx.createRadialGradient(x, y, R, x, y, R * 5);
  glow.addColorStop(0, 'rgba(255, 230, 100, 0.3)');
  glow.addColorStop(1, 'rgba(255, 200, 60, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, R * 5, 0, TAU); ctx.fill();

  // Disc
  ctx.fillStyle = 'rgba(255, 235, 130, 0.95)';
  ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();

  ctx.font = '400 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 235, 130, 0.7)';
  ctx.fillText('Sun', x, y + R + 10);
}

/**
 * Draw all stars from a pre-projected list.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ x: number, y: number, mag: number, ci: number|null }>} projected
 * @param {number|null} twinkleT  seconds (performance.now/1000), null = no twinkle
 */
export function drawStars(ctx, projected, twinkleT = null) {
  for (const { x, y, mag, ci } of projected) {
    const radius = magToRadius(mag);
    const [r, g, b] = bvToRgb(ci);
    let alpha = Math.min(0.95, 0.5 + (6.5 - mag) * 0.07);

    // Subtle per-star twinkle using a stable phase derived from position
    if (twinkleT !== null && mag < 5) {
      const phase = (x * 0.37 + y * 0.61) % (Math.PI * 2);
      const depth = mag < 2 ? 0.08 : 0.13;
      alpha = Math.min(0.98, Math.max(0.05, alpha * (1 + depth * Math.sin(twinkleT * 2.5 + phase))));
    }

    // Glow for bright stars (mag < 2.5)
    if (mag < 2.5) {
      const glowR = radius * (4 - mag * 0.5);
      const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glowGrad.addColorStop(0, `rgba(${r},${g},${b},0.15)`);
      glowGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, TAU);
      ctx.fill();
    }

    ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }
}

/**
 * Draw a "zenith" dot at the center.
 */
export function drawZenith(ctx, cx, cy) {
  ctx.fillStyle = 'rgba(168, 200, 255, 0.2)';
  ctx.beginPath();
  ctx.arc(cx, cy, 1.5, 0, TAU);
  ctx.fill();
}
