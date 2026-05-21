# Yıldız

Tonight's sky from your location. 9,000+ stars, constellations, planets, and the moon — in the browser, in real time.

**→ [yildiz.tahagenc.com](https://yildiz.tahagenc.com)**

---

## What it does

Open the page, share your location, see your sky. That's it.

- **9,000+ stars** from the HYG Database (magnitude ≤ 6.5)
- **88 constellations** with classical Latin names and Turkish equivalents
- **Planets and moon** with the moon's current phase rendered live
- **Time scrubber** — drag ±12 hours to watch the sky rotate
- **Click any star** for name, magnitude, distance, and spectral type
- **Shareable PNG** of your current view

## Why I built this

I wanted to know what was above my head on clear nights without downloading another app, creating another account, or handing my coordinates to ten SDKs. Stellarium Web is the gold standard but it's heavy; everything else either wants money or wants ads.

One URL. One permission prompt. One quiet, dark page.

## Tech

- **Vanilla JS + Vite** — no framework
- **astronomy-engine** — coordinate conversion (RA/Dec → Alt/Az), planet positions, moon phase
- **HYG Database v3** — public-domain star catalog, filtered and indexed
- **Canvas 2D** — stereographic projection from zenith
- **No backend, no tracking, no analytics**

Star catalog is ~600KB JSON (gzipped to ~150KB). All math runs in your browser.

## Run locally

```bash
git clone https://github.com/thgnx/yildiz
cd yildiz
npm install
npm run dev
```

## What I learned

- Coordinate conversion is unforgiving. UTC vs local time, observer latitude sign, and J2000 epoch all matter. I cross-checked Sirius, Vega, and Polaris against Stellarium before trusting any of my math.
- Stereographic projection from the zenith is what every planetarium app uses. The math is simpler than it looks; the hard part is mapping screen clicks back to the right star.
- Canvas handles 9,000 stars fine — the bottleneck is recomputing alt/az every frame. Cache the result; only invalidate when time or location changes.
- B-V color index → RGB is a real conversion astronomers do. Sirius is blue-white because of physics, not because I picked the color.
- Astronomical magnitude is logarithmic *and* inverted (lower number = brighter star). The most counter-intuitive scale in science.

## License

MIT © [Taha Genç](https://tahagenc.com)
