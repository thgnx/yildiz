import './style.css';
import { loadCatalog, loadConstellations } from './modules/catalog.js';
import { raDecToAltAz, getPlanets, getMoon, getSun } from './modules/astronomy.js';
import { project, skyLayout } from './modules/projection.js';
import {
  drawBackground, drawHorizon, drawAltitudeRings,
  drawStars, drawCardinals, drawZenith,
  drawConstellationLines, drawConstellationLabels,
  drawPlanets, drawMoon, drawSun,
} from './modules/renderer.js';
import {
  PRESET_CITIES, requestGeolocation, saveLocation,
  loadSavedLocation, formatCoords,
} from './modules/location.js';
import { initInteraction } from './modules/interaction.js';
import { initTimeline } from './modules/timeline.js';
import { initSettings, loadSettings } from './modules/settings.js';
import { exportShareCard } from './modules/shareCard.js';
import {
  showLocationOverlay, hideLocationOverlay,
  updateLocationPanel, showInfoPanel, showPlanetPanel,
  hideInfoPanel, showToast,
} from './modules/ui.js';

// ─── State ────────────────────────────────────────────────────────────────────

let observer     = null;
let astroCache   = null;
let interaction  = null;
let timeline     = null;
let settings     = loadSettings();
let allStars     = [];
let constellations = [];
let lastProjectedStars = [];

// Twinkle animation
let twinkleRafId  = null;
let lastTwinkleMs = 0;

// DOM refs
const canvas      = document.getElementById('sky');
const ctx         = canvas.getContext('2d');
const overlay     = document.getElementById('overlay-location');
const locPanel    = document.getElementById('panel-location');
const infoPanel   = document.getElementById('panel-info');
const tlContainer = document.getElementById('timeline-container');
const settingsContainer = document.getElementById('settings-container');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

function saveViewState({ zoom, panX, panY }) {
  try { localStorage.setItem('yildiz:view', JSON.stringify({ zoom, panX, panY })); } catch {}
}

function loadViewState() {
  try { return JSON.parse(localStorage.getItem('yildiz:view')) ?? null; } catch { return null; }
}

function starsForMag(magLimit) {
  return allStars.filter(s => s.mag <= magLimit);
}

// ─── Astro cache ──────────────────────────────────────────────────────────────

function computeAstroCache(lat, lng, date) {
  const filtered = starsForMag(settings.magLimit);
  const visibleStars = [];
  for (const star of filtered) {
    const pos = raDecToAltAz(star.ra, star.dec, lat, lng, date);
    if (pos.altitude > 0) visibleStars.push({ star, altitude: pos.altitude, azimuth: pos.azimuth });
  }

  const conAltAz = constellations.map(con => ({
    name: con.name, tr: con.tr, id: con.id,
    segAltAz: con.lines.map(([ra1, d1, ra2, d2]) => ({
      p1: raDecToAltAz(ra1, d1, lat, lng, date),
      p2: raDecToAltAz(ra2, d2, lat, lng, date),
    })),
    centerPos: raDecToAltAz(con.center[0], con.center[1], lat, lng, date),
  }));

  return {
    visibleStars,
    conAltAz,
    planets: getPlanets(lat, lng, date),
    moon:    getMoon(lat, lng, date),
    sun:     getSun(lat, lng, date),
    date,
  };
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render(zoom = 1, panX = 0, panY = 0, twinkleT = null) {
  if (!astroCache) return;

  const { visibleStars, conAltAz, planets, moon, sun } = astroCache;
  const base     = skyLayout(canvas.width, canvas.height);
  const horizonR = base.horizonR * zoom;
  const cx = base.cx + panX;
  const cy = base.cy + panY;

  const projected = [];
  for (const { star, altitude, azimuth } of visibleStars) {
    const pt = project(altitude, azimuth, cx, cy, horizonR);
    if (pt) projected.push({ x: pt.x, y: pt.y, mag: star.mag, ci: star.ci, star, altitude, azimuth });
  }
  lastProjectedStars = projected;

  const segments = [];
  const conLabels = [];
  for (const con of conAltAz) {
    for (const { p1, p2 } of con.segAltAz) {
      if (p1.altitude <= 0 || p2.altitude <= 0) continue;
      const s1 = project(p1.altitude, p1.azimuth, cx, cy, horizonR);
      const s2 = project(p2.altitude, p2.azimuth, cx, cy, horizonR);
      if (s1 && s2) segments.push([s1.x, s1.y, s2.x, s2.y]);
    }
    if (settings.showConLabels) {
      const cp = con.centerPos;
      if (cp.altitude > 5) {
        const sp = project(cp.altitude, cp.azimuth, cx, cy, horizonR);
        if (sp) conLabels.push({ name: con.name, tr: con.tr, x: sp.x, y: sp.y });
      }
    }
  }

  drawBackground(ctx, canvas.width, canvas.height, cx, cy, horizonR);
  drawAltitudeRings(ctx, cx, cy, horizonR);
  drawHorizon(ctx, cx, cy, horizonR);
  drawConstellationLines(ctx, segments);
  drawStars(ctx, projected, twinkleT);
  if (settings.showConLabels) drawConstellationLabels(ctx, conLabels, true);
  drawCardinals(ctx, cx, cy, horizonR);
  drawZenith(ctx, cx, cy);

  for (const planet of planets) {
    if (planet.altitude <= 0) continue;
    const pt = project(planet.altitude, planet.azimuth, cx, cy, horizonR);
    if (pt) drawPlanets(ctx, [{ ...planet, x: pt.x, y: pt.y }]);
  }

  const moonPt = moon.altitude > 0 ? project(moon.altitude, moon.azimuth, cx, cy, horizonR) : null;
  if (moonPt) drawMoon(ctx, moonPt.x, moonPt.y, Math.max(8, horizonR * 0.025), moon.phaseDeg);

  const sunPt = sun.altitude > 0 ? project(sun.altitude, sun.azimuth, cx, cy, horizonR) : null;
  if (sunPt) drawSun(ctx, sunPt.x, sunPt.y);
}

// ─── Twinkle loop (~8 fps) ────────────────────────────────────────────────────

function twinkleLoop(ts) {
  if (!settings.showTwinkle || !astroCache) { twinkleRafId = null; return; }
  if (ts - lastTwinkleMs > 120) {
    const s = interaction?.getState() ?? { zoom: 1, panX: 0, panY: 0 };
    render(s.zoom, s.panX, s.panY, ts * 0.001);
    lastTwinkleMs = ts;
  }
  twinkleRafId = requestAnimationFrame(twinkleLoop);
}

function startTwinkle() {
  if (!twinkleRafId) twinkleRafId = requestAnimationFrame(twinkleLoop);
}

function stopTwinkle() {
  if (twinkleRafId) { cancelAnimationFrame(twinkleRafId); twinkleRafId = null; }
}

// ─── Recompute + re-render (location or time changed) ─────────────────────────

function recompute(date) {
  if (!observer) return;
  astroCache = computeAstroCache(observer.lat, observer.lng, date);
  const state = interaction?.getState() ?? { zoom: 1, panX: 0, panY: 0 };
  render(state.zoom, state.panX, state.panY);
  updateTimeDisplay(date);
}

function updateTimeDisplay(date) {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  updateLocationPanel(locPanel, {
    name: observer.name || formatCoords(observer.lat, observer.lng),
    lat: observer.lat, lng: observer.lng,
    timeStr: `${h}:${m} local`,
  });
}

// ─── Location change ──────────────────────────────────────────────────────────

async function applyLocation(loc) {
  observer = loc;
  saveLocation(loc);
  if (timeline) timeline.reset();

  const date = new Date();
  astroCache = computeAstroCache(loc.lat, loc.lng, date);
  const state = interaction?.getState() ?? { zoom: 1, panX: 0, panY: 0 };
  render(state.zoom, state.panX, state.panY);
  updateTimeDisplay(date);
  hideLocationOverlay(overlay);
}

// ─── Click to identify ────────────────────────────────────────────────────────

function handleCanvasClick(px, py) {
  if (!astroCache) return;

  const { planets, moon } = astroCache;
  const state    = interaction?.getState() ?? { zoom: 1, panX: 0, panY: 0 };
  const base     = skyLayout(canvas.width, canvas.height);
  const horizonR = base.horizonR * state.zoom;
  const cx = base.cx + state.panX;
  const cy = base.cy + state.panY;

  for (const planet of planets) {
    if (planet.altitude <= 0) continue;
    const pt = project(planet.altitude, planet.azimuth, cx, cy, horizonR);
    if (pt && Math.hypot(px - pt.x, py - pt.y) < 20) {
      showPlanetPanel(infoPanel, planet);
      return;
    }
  }

  if (moon.altitude > 0) {
    const pt = project(moon.altitude, moon.azimuth, cx, cy, horizonR);
    if (pt && Math.hypot(px - pt.x, py - pt.y) < horizonR * 0.04) {
      showPlanetPanel(infoPanel, { name: 'Moon', ...moon, mag: -12.7 });
      return;
    }
  }

  let closest = null, bestDist = 16;
  for (const s of lastProjectedStars) {
    const d = Math.hypot(px - s.x, py - s.y);
    if (d < bestDist) { bestDist = d; closest = s; }
  }

  if (closest) showInfoPanel(infoPanel, closest);
  else         hideInfoPanel(infoPanel);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  resizeCanvas();

  [allStars, constellations] = await Promise.all([loadCatalog(), loadConstellations()]);

  // Timeline
  timeline = initTimeline(tlContainer, {
    onTimeChange: date => recompute(date),
  });

  // Settings
  initSettings(settingsContainer, {
    onUpdate: s => {
      settings = s;
      if (observer) recompute(timeline?.getDate() ?? new Date());
      if (s.showTwinkle) startTwinkle(); else stopTwinkle();
    },
  });

  // Settings toggle button
  const settingsBtn = locPanel.querySelector('#btn-settings-toggle');
  settingsBtn.addEventListener('click', () => {
    const isHidden = settingsContainer.hidden;
    settingsContainer.hidden = !isHidden;
    settingsBtn.setAttribute('aria-expanded', String(isHidden));
  });

  // Share button
  locPanel.querySelector('#btn-share').addEventListener('click', () => {
    const date = timeline?.getDate() ?? new Date();
    exportShareCard(canvas, observer?.name ?? '', date);
    showToast('Downloading PNG…');
  });

  // Interaction: zoom/pan with view-state persistence
  const savedView = loadViewState() ?? { zoom: 1, panX: 0, panY: 0 };
  interaction = initInteraction(canvas, {
    onUpdate: ({ zoom, panX, panY }) => {
      saveViewState({ zoom, panX, panY });
      render(zoom, panX, panY);
    },
    onClick: (x, y) => handleCanvasClick(x, y),
    initialState: savedView,
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') hideInfoPanel(infoPanel);
  });

  infoPanel.querySelector('.btn-close-info').addEventListener('click', () => hideInfoPanel(infoPanel));

  const locationOverlayCallbacks = {
    onGps: async () => {
      const pos = await requestGeolocation();
      await applyLocation({ lat: pos.lat, lng: pos.lng, name: formatCoords(pos.lat, pos.lng) });
      showToast('Location updated');
    },
    onCity:   city        => applyLocation(city),
    onManual: (lat, lng)  => applyLocation({ lat, lng, name: formatCoords(lat, lng) }),
  };

  locPanel.querySelector('#btn-change-location').addEventListener('click', () => {
    showLocationOverlay(overlay, locationOverlayCallbacks, PRESET_CITIES);
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    const s = interaction.getState();
    render(s.zoom, s.panX, s.panY);
  });

  const saved = loadSavedLocation();
  if (saved) {
    await applyLocation(saved);
  } else {
    observer = { lat: 41.0082, lng: 28.9784, name: 'İstanbul' };
    astroCache = computeAstroCache(observer.lat, observer.lng, new Date());
    const sv = interaction.getState();
    render(sv.zoom, sv.panX, sv.panY);
    showLocationOverlay(overlay, locationOverlayCallbacks, PRESET_CITIES);
  }

  if (settings.showTwinkle) startTwinkle();
}

init();
