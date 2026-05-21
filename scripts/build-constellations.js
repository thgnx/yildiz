/**
 * Downloads d3-celestial constellation line + metadata files,
 * converts RA from degrees to hours, outputs public/data/constellations.json
 *
 * Run: node scripts/build-constellations.js
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../public/data/constellations.json');

const LINES_URL = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.lines.json';
const META_URL  = 'https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/constellations.json';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) { get(res.headers.location); return; }
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

// d3-celestial stores RA in degrees (0-360); astronomy-engine expects hours (0-24)
const degToHours = deg => deg / 15;

function computeCenter(lines) {
  // Average of all unique endpoints (in RA hours, Dec degrees)
  let sumRa = 0, sumDec = 0, count = 0;
  for (const seg of lines) {
    for (let i = 0; i < seg.length; i += 2) {
      sumRa  += seg[i];
      sumDec += seg[i + 1];
      count++;
    }
  }
  return count ? [sumRa / count, sumDec / count] : [0, 0];
}

async function main() {
  console.log('Downloading constellation lines...');
  const [linesRaw, metaRaw] = await Promise.all([fetchText(LINES_URL), fetchText(META_URL)]);

  const linesGeo = JSON.parse(linesRaw);
  const metaGeo  = JSON.parse(metaRaw);

  // Build id → metadata map
  const metaMap = {};
  for (const f of metaGeo.features) {
    metaMap[f.id] = f.properties;
  }

  const constellations = [];

  for (const feature of linesGeo.features) {
    const id   = feature.id;
    const meta = metaMap[id] || {};
    const geom = feature.geometry; // MultiLineString

    // Convert each line segment: [[ra_deg, dec], ...] → flat [ra_h, dec, ra_h, dec, ...]
    const lines = [];
    for (const coordPair of geom.coordinates) {
      // coordPair is an array of [ra_deg, dec] points forming a polyline
      // Convert to line segments (consecutive pairs)
      for (let i = 0; i < coordPair.length - 1; i++) {
        const [ra1d, dec1] = coordPair[i];
        const [ra2d, dec2] = coordPair[i + 1];
        lines.push([
          parseFloat(degToHours(ra1d).toFixed(4)),
          parseFloat(dec1.toFixed(4)),
          parseFloat(degToHours(ra2d).toFixed(4)),
          parseFloat(dec2.toFixed(4)),
        ]);
      }
    }

    const center = computeCenter(lines);

    constellations.push({
      id,
      name: meta.la || meta.en || id,
      tr:   meta.tr || meta.en || id,
      lines,
      center,
    });
  }

  constellations.sort((a, b) => a.id.localeCompare(b.id));

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(constellations));

  const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`Written: ${OUT_PATH} (${kb} KB, ${constellations.length} constellations)`);

  const orion = constellations.find(c => c.id === 'Ori');
  if (orion) console.log('Orion check:', JSON.stringify({ name: orion.name, tr: orion.tr, segments: orion.lines.length, center: orion.center }));
}

main().catch(e => { console.error(e); process.exit(1); });
