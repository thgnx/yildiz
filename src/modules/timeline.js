/**
 * Timeline scrubber — draggable bar spanning ±12 h from "now".
 * Calls onTimeChange(date) on every update.
 */

const RANGE_H = 12;       // ±12 hours from base
const RANGE_MS = RANGE_H * 3600_000;

export function initTimeline(container, { onTimeChange }) {
  // Base time snapped to current moment on init; "Now" resets to wall clock
  let baseDate = new Date();
  let offsetMs = 0;    // offset from baseDate
  let dragging  = false;
  let dragStartX = 0;
  let dragStartOffset = 0;

  // ─── Build DOM ────────────────────────────────────────────────────────────

  container.innerHTML = `
    <div class="tl-track" role="slider" aria-label="Time scrubber" aria-valuemin="-720" aria-valuemax="720" tabindex="0">
      <div class="tl-fill"></div>
      <div class="tl-thumb"></div>
    </div>
    <div class="tl-labels">
      <span class="tl-label-left">−12h</span>
      <span class="tl-label-center"></span>
      <span class="tl-label-right">+12h</span>
    </div>
    <button class="tl-now btn-text" aria-label="Jump to current time">Now</button>
  `;

  const track  = container.querySelector('.tl-track');
  const fill   = container.querySelector('.tl-fill');
  const thumb  = container.querySelector('.tl-thumb');
  const label  = container.querySelector('.tl-label-center');
  const nowBtn = container.querySelector('.tl-now');

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function currentDate() {
    return new Date(baseDate.getTime() + offsetMs);
  }

  function offsetToFraction(ms) {
    return (ms + RANGE_MS) / (2 * RANGE_MS);   // 0 = full-left, 1 = full-right
  }

  function fractionToOffset(f) {
    return Math.max(-RANGE_MS, Math.min(RANGE_MS, (f * 2 - 1) * RANGE_MS));
  }

  function formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const dayDiff = Math.round((date - baseDate) / 86_400_000);
    const suffix  = dayDiff === 0 ? '' : dayDiff > 0 ? ` (+${dayDiff}d)` : ` (${dayDiff}d)`;
    return `${h}:${m}${suffix}`;
  }

  function updateUI() {
    const frac = offsetToFraction(offsetMs);
    const pct  = `${(frac * 100).toFixed(2)}%`;
    thumb.style.left = pct;
    fill.style.width = pct;
    label.textContent = formatTime(currentDate());
    track.setAttribute('aria-valuenow', Math.round(offsetMs / 60_000));
    nowBtn.style.opacity = offsetMs === 0 ? '0.3' : '1';
  }

  function applyOffset(ms, emit = true) {
    offsetMs = Math.max(-RANGE_MS, Math.min(RANGE_MS, ms));
    updateUI();
    if (emit) onTimeChange(currentDate());
  }

  // ─── Drag (mouse) ─────────────────────────────────────────────────────────

  function onMouseDown(e) {
    e.preventDefault();
    dragging = true;
    dragStartX = e.clientX;
    dragStartOffset = offsetMs;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  }

  function onMouseMove(e) {
    if (!dragging) return;
    const rect  = track.getBoundingClientRect();
    const delta = (e.clientX - dragStartX) / rect.width;
    applyOffset(dragStartOffset + delta * 2 * RANGE_MS);
  }

  function onMouseUp() {
    dragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup',   onMouseUp);
  }

  // Click on track background → jump to that position
  function onTrackClick(e) {
    if (dragging) return;
    const rect = track.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    applyOffset(fractionToOffset(frac));
  }

  // ─── Touch ────────────────────────────────────────────────────────────────

  let touchStartX = 0;
  let touchStartOffset = 0;

  function onTouchStart(e) {
    e.preventDefault();
    touchStartX      = e.touches[0].clientX;
    touchStartOffset = offsetMs;
  }

  function onTouchMove(e) {
    e.preventDefault();
    const rect  = track.getBoundingClientRect();
    const delta = (e.touches[0].clientX - touchStartX) / rect.width;
    applyOffset(touchStartOffset + delta * 2 * RANGE_MS);
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────

  function onKeyDown(e) {
    const step = e.shiftKey ? 3_600_000 : 300_000;   // shift = 1h, else 5 min
    if      (e.key === 'ArrowLeft')  applyOffset(offsetMs - step);
    else if (e.key === 'ArrowRight') applyOffset(offsetMs + step);
    else if (e.key === 'Home' || e.key === '0') applyOffset(0);
    else return;
    e.preventDefault();
  }

  // ─── Now button ───────────────────────────────────────────────────────────

  nowBtn.addEventListener('click', () => {
    baseDate = new Date();
    applyOffset(0);
  });

  // ─── Wire up ──────────────────────────────────────────────────────────────

  thumb.addEventListener('mousedown', onMouseDown);
  track.addEventListener('click',     onTrackClick);
  track.addEventListener('touchstart', onTouchStart, { passive: false });
  track.addEventListener('touchmove',  onTouchMove,  { passive: false });
  track.addEventListener('keydown',    onKeyDown);

  updateUI();

  return {
    getDate() { return currentDate(); },
    reset()   { baseDate = new Date(); applyOffset(0, false); },
    cleanup() {
      thumb.removeEventListener('mousedown', onMouseDown);
      track.removeEventListener('click',     onTrackClick);
      track.removeEventListener('touchstart', onTouchStart);
      track.removeEventListener('touchmove',  onTouchMove);
      track.removeEventListener('keydown',    onKeyDown);
    },
  };
}
