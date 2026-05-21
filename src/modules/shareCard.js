/**
 * Export the sky canvas as a PNG download.
 * Stamps a small watermark at bottom-right before exporting.
 */

export function exportShareCard(canvas, observerName, date) {
  // Draw watermark onto a temp canvas to avoid mutating the live one
  const tmp = document.createElement('canvas');
  tmp.width  = canvas.width;
  tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');

  // Copy current sky frame
  tctx.drawImage(canvas, 0, 0);

  // Watermark
  const label = observerName
    ? `Yıldız · ${observerName} · ${formatDate(date)}`
    : `Yıldız · ${formatDate(date)}`;

  tctx.font = '13px Inter, system-ui, sans-serif';
  tctx.textAlign = 'right';
  tctx.textBaseline = 'bottom';

  const x = canvas.width  - 16;
  const y = canvas.height - 16;
  const metrics = tctx.measureText(label);
  const pad = 6;

  tctx.fillStyle = 'rgba(5,6,8,0.6)';
  tctx.beginPath();
  tctx.roundRect(
    x - metrics.width - pad, y - 14 - pad,
    metrics.width + pad * 2, 14 + pad * 2,
    4
  );
  tctx.fill();

  tctx.fillStyle = 'rgba(232, 227, 214, 0.75)';
  tctx.fillText(label, x, y);

  // Download
  tmp.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yildiz-${formatFilename(date)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }, 'image/png');
}

function formatDate(date) {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFilename(date) {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${y}${m}${d}-${h}${min}`;
}
