/**
 * Handles canvas zoom (mouse wheel + pinch) and pan (drag + touch).
 * Click vs drag: a mouseup/touchend within 5px of start is treated as a click.
 */

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export function initInteraction(canvas, { onUpdate, onClick, initialState = {} }) {
  let zoom = initialState.zoom ?? 1;
  let panX = initialState.panX ?? 0;
  let panY = initialState.panY ?? 0;

  // Drag state
  let dragging   = false;
  let dragStart  = { x: 0, y: 0 };
  let panAtStart = { x: 0, y: 0 };

  // Pinch state
  let pinchStartDist = 0;
  let zoomAtPinch    = 1;

  function getState() { return { zoom, panX, panY }; }

  function clampPan(z) {
    if (z <= 1) { panX = 0; panY = 0; return; }
    const limit = (z - 1) * Math.min(canvas.width, canvas.height) * 0.46;
    panX = Math.max(-limit, Math.min(limit, panX));
    panY = Math.max(-limit, Math.min(limit, panY));
  }

  function resetView() { zoom = 1; panX = 0; panY = 0; onUpdate(getState()); }

  // ─── Mouse ────────────────────────────────────────────────────────────────

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
    clampPan(zoom);
    onUpdate(getState());
  }

  function onMouseDown(e) {
    dragging   = true;
    dragStart  = { x: e.clientX, y: e.clientY };
    panAtStart = { x: panX, y: panY };
    canvas.style.cursor = 'grabbing';
  }

  function onMouseMove(e) {
    if (!dragging) return;
    panX = panAtStart.x + (e.clientX - dragStart.x);
    panY = panAtStart.y + (e.clientY - dragStart.y);
    clampPan(zoom);
    onUpdate(getState());
  }

  function onMouseUp(e) {
    if (!dragging) return;
    dragging = false;
    canvas.style.cursor = zoom > 1 ? 'grab' : '';
    const moved = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
    if (moved < 5) onClick(e.clientX, e.clientY);
  }

  function onDblClick() { resetView(); }

  // ─── Touch ────────────────────────────────────────────────────────────────

  function pinchDist(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  let touchStart = null;

  function onTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      touchStart  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panAtStart  = { x: panX, y: panY };
      pinchStartDist = 0;
    } else if (e.touches.length === 2) {
      touchStart     = null;
      pinchStartDist = pinchDist(e.touches);
      zoomAtPinch    = zoom;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1 && touchStart) {
      panX = panAtStart.x + (e.touches[0].clientX - touchStart.x);
      panY = panAtStart.y + (e.touches[0].clientY - touchStart.y);
      clampPan(zoom);
      onUpdate(getState());
    } else if (e.touches.length === 2 && pinchStartDist) {
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomAtPinch * pinchDist(e.touches) / pinchStartDist));
      clampPan(zoom);
      onUpdate(getState());
    }
  }

  function onTouchEnd(e) {
    e.preventDefault();
    if (e.changedTouches.length === 1 && touchStart) {
      const t = e.changedTouches[0];
      const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y);
      if (moved < 10) onClick(t.clientX, t.clientY);
      touchStart = null;
    }
  }

  canvas.addEventListener('wheel',      onWheel,      { passive: false });
  canvas.addEventListener('mousedown',  onMouseDown);
  window.addEventListener('mousemove',  onMouseMove);
  window.addEventListener('mouseup',    onMouseUp);
  canvas.addEventListener('dblclick',   onDblClick);
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove',  onTouchMove,  { passive: false });
  canvas.addEventListener('touchend',   onTouchEnd,   { passive: false });

  return {
    getState,
    resetView,
    cleanup() {
      canvas.removeEventListener('wheel',      onWheel);
      canvas.removeEventListener('mousedown',  onMouseDown);
      window.removeEventListener('mousemove',  onMouseMove);
      window.removeEventListener('mouseup',    onMouseUp);
      canvas.removeEventListener('dblclick',   onDblClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove',  onTouchMove);
      canvas.removeEventListener('touchend',   onTouchEnd);
    },
  };
}
