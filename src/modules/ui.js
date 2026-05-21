/**
 * DOM panel helpers — location overlay, info panel, toast.
 * All functions take DOM element references injected from main.js.
 */

// ─── Location overlay ─────────────────────────────────────────────────────────

/**
 * Show the location setup overlay.
 * @param {HTMLElement} overlay
 * @param {{ onGps, onCity, onManual, onError }} callbacks
 * @param {Array} cities
 */
export function showLocationOverlay(overlay, { onGps, onCity, onManual }, cities) {
  overlay.hidden = false;

  // City buttons
  const cityList = overlay.querySelector('.city-list');
  cityList.innerHTML = '';
  for (const city of cities) {
    const btn = document.createElement('button');
    btn.className = 'btn-city';
    btn.textContent = city.name;
    btn.addEventListener('click', () => onCity(city));
    cityList.appendChild(btn);
  }

  // GPS button
  const gpsBtn = overlay.querySelector('#btn-gps');
  gpsBtn.addEventListener('click', async () => {
    gpsBtn.textContent = 'Locating…';
    gpsBtn.disabled = true;
    try {
      await onGps();
    } catch (err) {
      gpsBtn.textContent = 'Use my location';
      gpsBtn.disabled = false;
      const errEl = overlay.querySelector('.location-error');
      if (errEl) { errEl.textContent = err.message; errEl.hidden = false; }
    }
  });

  // Manual input
  const manualBtn = overlay.querySelector('#btn-manual');
  manualBtn.addEventListener('click', () => {
    const lat = parseFloat(overlay.querySelector('#input-lat').value);
    const lng = parseFloat(overlay.querySelector('#input-lng').value);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      const errEl = overlay.querySelector('.location-error');
      if (errEl) { errEl.textContent = 'Invalid coordinates.'; errEl.hidden = false; }
      return;
    }
    onManual(lat, lng);
  });

  // Allow pressing Enter in manual inputs
  for (const input of overlay.querySelectorAll('.manual-coords input')) {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') manualBtn.click(); });
  }
}

export function hideLocationOverlay(overlay) {
  overlay.hidden = true;
}

// ─── Location panel (top-left) ────────────────────────────────────────────────

export function updateLocationPanel(panel, { name, lat, lng, timeStr }) {
  panel.hidden = false;
  panel.querySelector('.loc-name').textContent  = name;
  panel.querySelector('.loc-coords').textContent = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(2)}°${lng >= 0 ? 'E' : 'W'}`;
  if (timeStr) panel.querySelector('.loc-time').textContent = timeStr;
}

// ─── Info panel (top-right) ───────────────────────────────────────────────────

const CON_FULL = {
  And:'Andromeda', Ant:'Antlia', Aps:'Apus', Aql:'Aquila', Aqr:'Aquarius',
  Ara:'Ara', Ari:'Aries', Aur:'Auriga', Boo:'Boötes', Cae:'Caelum',
  Cam:'Camelopardalis', Cap:'Capricornus', Car:'Carina', Cas:'Cassiopeia',
  Cen:'Centaurus', Cep:'Cepheus', Cet:'Cetus', Cha:'Chamaeleon', Cir:'Circinus',
  CMa:'Canis Major', CMi:'Canis Minor', Cnc:'Cancer', Col:'Columba', Com:'Coma Berenices',
  CrA:'Corona Australis', CrB:'Corona Borealis', Crt:'Crater', Cru:'Crux', Crv:'Corvus',
  CVn:'Canes Venatici', Cyg:'Cygnus', Del:'Delphinus', Dor:'Dorado', Dra:'Draco',
  Equ:'Equuleus', Eri:'Eridanus', For:'Fornax', Gem:'Gemini', Gru:'Grus',
  Her:'Hercules', Hor:'Horologium', Hya:'Hydra', Hyi:'Hydrus', Ind:'Indus',
  Lac:'Lacerta', Leo:'Leo', LMi:'Leo Minor', Lep:'Lepus', Lib:'Libra',
  Lup:'Lupus', Lyn:'Lynx', Lyr:'Lyra', Men:'Mensa', Mic:'Microscopium',
  Mon:'Monoceros', Mus:'Musca', Nor:'Norma', Oct:'Octans', Oph:'Ophiuchus',
  Ori:'Orion', Pav:'Pavo', Peg:'Pegasus', Per:'Perseus', Phe:'Phoenix',
  Pic:'Pictor', PsA:'Piscis Austrinus', Psc:'Pisces', Pup:'Puppis', Pyx:'Pyxis',
  Ret:'Reticulum', Scl:'Sculptor', Sco:'Scorpius', Sct:'Scutum', Ser:'Serpens',
  Sex:'Sextans', Sge:'Sagitta', Sgr:'Sagittarius', Tau:'Taurus', Tel:'Telescopium',
  TrA:'Triangulum Australe', Tri:'Triangulum', Tuc:'Tucana', UMa:'Ursa Major',
  UMi:'Ursa Minor', Vel:'Vela', Vir:'Virgo', Vol:'Volans', Vul:'Vulpecula',
};

function formatMag(mag) {
  return mag >= 0 ? `+${mag.toFixed(2)}` : mag.toFixed(2);
}

function formatDist(ly) {
  if (!ly) return '—';
  if (ly < 10) return `${ly.toFixed(1)} ly`;
  return `${Math.round(ly)} ly`;
}

/**
 * Show the star info panel.
 * @param {HTMLElement} panel
 * @param {{ star: object, altitude: number, azimuth: number }} item
 */
export function showInfoPanel(panel, { star, altitude, azimuth }) {
  const name  = star.n  || star.bf?.replace(/\d+/, '').trim() || 'Unknown star';
  const bayer = star.bf || '—';
  const con   = star.con ? (CON_FULL[star.con] || star.con) : '—';

  panel.querySelector('.info-name').textContent = name;
  panel.querySelector('.info-type').textContent = 'Star';

  const rows = [
    ['Bayer',         bayer],
    ['Magnitude',     formatMag(star.mag)],
    ['Distance',      formatDist(star.dist)],
    ['Spectrum',      star.sp || '—'],
    ['Constellation', con],
    ['Altitude',      `${altitude.toFixed(1)}°`],
    ['Azimuth',       `${azimuth.toFixed(1)}°`],
  ];

  const tbody = panel.querySelector('.info-rows');
  tbody.innerHTML = rows.map(([label, val]) =>
    `<div class="info-row"><span class="info-label">${label}</span><span class="info-val">${val}</span></div>`
  ).join('');

  panel.hidden = false;
  panel.querySelector('.btn-close-info').focus();
}

export function showPlanetPanel(panel, { name, altitude, azimuth, mag }) {
  panel.querySelector('.info-name').textContent = name;
  panel.querySelector('.info-type').textContent = 'Planet';

  const rows = [
    ['Magnitude', formatMag(mag)],
    ['Altitude',  `${altitude.toFixed(1)}°`],
    ['Azimuth',   `${azimuth.toFixed(1)}°`],
  ];

  panel.querySelector('.info-rows').innerHTML = rows.map(([l, v]) =>
    `<div class="info-row"><span class="info-label">${l}</span><span class="info-val">${v}</span></div>`
  ).join('');

  panel.hidden = false;
  panel.querySelector('.btn-close-info').focus();
}

export function hideInfoPanel(panel) {
  panel.hidden = true;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function showToast(message, durationMs = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.remove('toast-hide');
  toast.classList.add('toast-show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
  }, durationMs);
}
