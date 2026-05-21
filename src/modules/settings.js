/**
 * App settings: persisted to localStorage, exposed via a panel toggle.
 * Keys: showConLabels (bool), magLimit (number 3–7), showTwinkle (bool)
 */

const KEY = 'yildiz:settings';

const DEFAULTS = {
  showConLabels: true,
  magLimit: 6.5,
  showTwinkle: true,
};

let current = { ...DEFAULTS };

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) current = { ...DEFAULTS, ...saved };
  } catch {}
  return { ...current };
}

export function getSettings() { return { ...current }; }

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch {}
}

/**
 * Build and attach the settings panel to `container`.
 * Calls onUpdate(settings) whenever a setting changes.
 */
export function initSettings(container, { onUpdate }) {
  loadSettings();

  container.innerHTML = `
    <div class="settings-row">
      <label class="settings-label">
        <span>Constellation labels</span>
        <input type="checkbox" id="set-con-labels" ${current.showConLabels ? 'checked' : ''} />
      </label>
    </div>
    <div class="settings-row">
      <label class="settings-label" for="set-mag">
        <span>Magnitude limit <span class="set-mag-val">${current.magLimit.toFixed(1)}</span></span>
      </label>
      <input type="range" id="set-mag" min="3" max="7" step="0.5" value="${current.magLimit}" />
    </div>
    <div class="settings-row">
      <label class="settings-label">
        <span>Twinkle effect</span>
        <input type="checkbox" id="set-twinkle" ${current.showTwinkle ? 'checked' : ''} />
      </label>
    </div>
  `;

  const conLabelsEl = container.querySelector('#set-con-labels');
  const magEl       = container.querySelector('#set-mag');
  const magValEl    = container.querySelector('.set-mag-val');
  const twinkleEl   = container.querySelector('#set-twinkle');

  conLabelsEl.addEventListener('change', () => {
    current.showConLabels = conLabelsEl.checked;
    persist();
    onUpdate(getSettings());
  });

  magEl.addEventListener('input', () => {
    current.magLimit = parseFloat(magEl.value);
    magValEl.textContent = current.magLimit.toFixed(1);
    persist();
    onUpdate(getSettings());
  });

  twinkleEl.addEventListener('change', () => {
    current.showTwinkle = twinkleEl.checked;
    persist();
    onUpdate(getSettings());
  });

  return { getSettings };
}
