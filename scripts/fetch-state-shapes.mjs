// Regenerates src/data/stateShapes.json from OpenStreetMap (via Nominatim).
// Usage: node scripts/fetch-state-shapes.mjs
// Output: { [code]: { bbox: [south, west, north, east], rings: [[[lng, lat], ...], ...] } }
// Boundaries are simplified (~2 km) — good enough for framing, outlines and containment.
import { writeFile } from 'node:fs/promises';

const STATES = {
  AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar', CG: 'Chhattisgarh', GA: 'Goa', GJ: 'Gujarat',
  HR: 'Haryana', HP: 'Himachal Pradesh', JH: 'Jharkhand', KA: 'Karnataka', KL: 'Kerala', MP: 'Madhya Pradesh',
  MH: 'Maharashtra', MN: 'Manipur', ML: 'Meghalaya', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha', PB: 'Punjab',
  RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TG: 'Telangana', TR: 'Tripura', UP: 'Uttar Pradesh',
  UK: 'Uttarakhand', WB: 'West Bengal', AN: 'Andaman and Nicobar Islands', CH: 'Chandigarh',
  DD: 'Dadra and Nagar Haveli and Daman and Diu', DL: 'Delhi', JK: 'Jammu and Kashmir', LA: 'Ladakh',
  LD: 'Lakshadweep', PY: 'Puducherry',
};

const round = (v) => Math.round(v * 1000) / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchState(name, threshold = 0.02) {
  const params = new URLSearchParams({
    q: `${name}, India`,
    format: 'jsonv2',
    countrycodes: 'in',
    featureType: 'state',
    polygon_geojson: '1',
    polygon_threshold: String(threshold),
    limit: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'gully-guessr-data-script/1.0', 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const [hit] = await res.json();
  if (!hit?.geojson) throw new Error(`${name}: no boundary`);
  const { type, coordinates } = hit.geojson;
  const polygons = type === 'Polygon' ? [coordinates] : type === 'MultiPolygon' ? coordinates : [];
  const rings = polygons
    .map((poly) => poly[0].map(([lng, lat]) => [round(lng), round(lat)]))
    .filter((ring) => ring.length >= 4);
  const [s, n, w, e] = hit.boundingbox.map(Number);
  return { bbox: [round(s), round(w), round(n), round(e)], rings, label: hit.display_name };
}

const out = {};
for (const [code, name] of Object.entries(STATES)) {
  let shape = await fetchState(name);
  const [s, w, n, e] = shape.bbox;
  if (Math.max(n - s, e - w) < 2) {
    // Small states/UTs need finer detail or their outline collapses to a few points.
    await sleep(1100);
    shape = await fetchState(name, 0.002);
  }
  const points = shape.rings.reduce((sum, r) => sum + r.length, 0);
  console.log(`${code} ${name}: ${shape.rings.length} rings, ${points} pts — ${shape.label}`);
  out[code] = { bbox: shape.bbox, rings: shape.rings };
  await sleep(1100);
}
await writeFile(new URL('../src/data/stateShapes.json', import.meta.url), JSON.stringify(out));
console.log('wrote src/data/stateShapes.json');
