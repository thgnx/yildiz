/**
 * Downloads HYG Database v38 (gzipped CSV) and filters to magnitude <= 6.5 stars.
 * Outputs compact JSON to public/data/stars.json.
 *
 * Run: node scripts/build-stars.js
 */

import https from 'https';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../public/data/stars.json');
const MAG_LIMIT = 6.5;

const HYG_URL = 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v38.csv.gz';

// HYG v38 column indices (0-based, from header):
// id,hip,hd,hr,gl,bf,proper,ra,dec,dist,pmra,pmdec,rv,mag,absmag,spect,ci,...,bayer,flam,con,...
const COL = {
  hr: 3,
  bf: 5,      // Bayer/Flamsteed combined (e.g. "Alp CMa")
  proper: 6,
  ra: 7,      // hours (J2000)
  dec: 8,     // degrees (J2000)
  dist: 9,    // parsecs
  mag: 13,
  spect: 15,
  ci: 16,     // B-V color index
  bayer: 27,  // Bayer letter only
  con: 29,    // constellation abbreviation (3 letters)
};

const PARSEC_TO_LY = 3.26156;

function fetchGzipped(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location);
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          zlib.gunzip(buf, (err, result) => {
            if (err) reject(err);
            else resolve(result.toString('utf8'));
          });
        });
        res.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

// Handles quoted CSV fields
function parseLine(line) {
  const cols = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

function buildStars(csv) {
  const lines = csv.split('\n');
  const stars = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const c = parseLine(line);
    const mag = parseFloat(c[COL.mag]);

    if (isNaN(mag) || mag > MAG_LIMIT) continue;

    // Skip Sol (id=0)
    if (c[0] === '0') continue;

    const dist = parseFloat(c[COL.dist]);
    const ci = parseFloat(c[COL.ci]);
    const hrRaw = c[COL.hr];

    stars.push({
      hr: hrRaw ? parseInt(hrRaw, 10) : null,
      n: c[COL.proper] || null,
      bf: c[COL.bf] || null,
      con: c[COL.con] || null,
      ra: parseFloat(c[COL.ra]),
      dec: parseFloat(c[COL.dec]),
      mag: parseFloat(mag.toFixed(2)),
      ci: isNaN(ci) ? null : parseFloat(ci.toFixed(3)),
      dist: isNaN(dist) || dist <= 0 ? null : Math.round(dist * PARSEC_TO_LY),
      sp: c[COL.spect] || null,
    });
  }

  // Sort brightest first — render loop processes in priority order
  stars.sort((a, b) => a.mag - b.mag);
  return stars;
}

async function main() {
  console.log('Downloading HYG v38...');
  const csv = await fetchGzipped(HYG_URL);
  console.log(`Decompressed: ${(csv.length / 1024 / 1024).toFixed(1)} MB`);

  const stars = buildStars(csv);
  console.log(`Stars (mag ≤ ${MAG_LIMIT}): ${stars.length}`);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(stars));

  const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(0);
  console.log(`Written: ${OUT_PATH} (${sizeKb} KB)`);

  const sirius = stars.find(s => s.n && s.n.toLowerCase() === 'sirius');
  console.log('Sirius:', sirius ? JSON.stringify(sirius) : 'NOT FOUND');

  const betelgeuse = stars.find(s => s.n && s.n.toLowerCase() === 'betelgeuse');
  console.log('Betelgeuse:', betelgeuse ? JSON.stringify(betelgeuse) : 'NOT FOUND');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
