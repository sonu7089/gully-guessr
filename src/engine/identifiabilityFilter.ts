import { OVERPASS_TIMEOUT_MS } from '../config';
import type { Archetype, LatLng } from './types';

export interface OsmElement {
  type: 'node' | 'way' | 'relation' | 'area';
  tags?: Record<string, string>;
}

export interface IdentifiabilityVerdict {
  accept: boolean;
  /** Higher = more identifiable. Used to rank concurrent candidates. */
  score: number;
  reasons: string[];
  inForest: boolean;
  /** True when Overpass could not be reached and we fell back to accepting. */
  degraded: boolean;
  roadName?: string;
  roadRef?: string;
  settlement?: string;
}

const ROAD_RANK: Record<string, number> = {
  motorway: 6, trunk: 6, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 2, living_street: 1, service: 1, track: 0,
};

export const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

export function buildOverpassQuery({ lat, lng }: LatLng, radiusM = 400): string {
  const c = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `[out:json][timeout:3];
is_in(${c})->.a;
(area.a["landuse"="forest"];area.a["natural"="wood"];area.a["boundary"="protected_area"];area.a["boundary"="national_park"];area.a["leisure"="nature_reserve"];);
out tags;
(
way(around:${radiusM},${c})["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track)$"];
node(around:${radiusM},${c})["shop"];
node(around:${radiusM},${c})["amenity"];
node(around:${radiusM},${c})["highway"="bus_stop"];
way(around:${radiusM},${c})["building"];
node(around:2000,${c})["place"~"^(city|town|village|suburb|hamlet|neighbourhood)$"];
);
out tags 80;`;
}

const isForestTag = (t: Record<string, string>) =>
  t.landuse === 'forest' || t.natural === 'wood' || t.boundary === 'protected_area' || t.boundary === 'national_park' || t.leisure === 'nature_reserve';

/** Pure classifier — the anti-forest rule lives here so it is unit-testable. */
export function classifyOsm(elements: readonly OsmElement[], archetype: Archetype): IdentifiabilityVerdict {
  let inForest = false;
  let roads = 0, namedRoads = 0, shops = 0, amenities = 0, busStops = 0, buildings = 0, places = 0;
  let bestRoad: { rank: number; name?: string; ref?: string } | null = null;
  let settlement: string | undefined;

  for (const el of elements) {
    const t = el.tags ?? {};
    if (el.type === 'area') {
      if (isForestTag(t)) inForest = true;
      continue;
    }
    if (t.highway && t.highway in ROAD_RANK) {
      roads++;
      if (t.name || t.ref) namedRoads++;
      const rank = ROAD_RANK[t.highway];
      if (!bestRoad || rank > bestRoad.rank || (rank === bestRoad.rank && !bestRoad.ref && t.ref)) {
        bestRoad = { rank, name: t['name:en'] ?? t.name, ref: t.ref };
      }
    } else if (t.highway === 'bus_stop') busStops++;
    if (t.shop) shops++;
    if (t.amenity) amenities++;
    if (t.building) buildings++;
    if (t.place) {
      places++;
      settlement ??= t['name:en'] ?? t.name;
    }
  }

  const settlementSignals = shops + amenities + busStops + buildings + places;
  const score =
    Math.min(namedRoads, 6) * 2 + Math.min(shops + amenities, 10) * 1.5 + Math.min(buildings, 20) * 0.5 + busStops * 2 + places * 3 + (bestRoad?.rank ?? 0);
  const reasons: string[] = [];
  let accept = true;

  if (archetype === 'forest_wilderness') {
    if (roads === 0 && settlementSignals === 0 && elements.length > 0) reasons.push('no-mapped-road');
    reasons.push('forest-roll');
  } else if (inForest && settlementSignals === 0 && namedRoads === 0) {
    accept = false;
    reasons.push('forest-without-settlement');
  } else if (settlementSignals > 0 || namedRoads > 0) {
    reasons.push('identifiable');
  } else {
    reasons.push('sparse');
  }

  return {
    accept,
    score,
    reasons,
    inForest,
    degraded: false,
    roadName: bestRoad?.name,
    roadRef: bestRoad?.ref,
    settlement,
  };
}

const DEGRADED: IdentifiabilityVerdict = { accept: true, score: 0, reasons: ['overpass-unavailable'], inForest: false, degraded: true };

/** Circuit breaker: after repeated failures (offline, blocked, rate-limited) skip Overpass for a while. */
const BREAKER_THRESHOLD = 2;
const BREAKER_COOLDOWN_MS = 30 * 60 * 1000;
const BREAKER_KEY = 'gullyguessr:overpass-disabled-until';
let consecutiveFailures = 0;
let disabledUntil = (() => {
  try {
    return Number(globalThis.sessionStorage?.getItem(BREAKER_KEY)) || 0;
  } catch {
    return 0;
  }
})();

function recordOverpassResult(ok: boolean): void {
  if (ok) {
    consecutiveFailures = 0;
    return;
  }
  consecutiveFailures++;
  if (consecutiveFailures >= BREAKER_THRESHOLD) {
    disabledUntil = Date.now() + BREAKER_COOLDOWN_MS;
    try {
      globalThis.sessionStorage?.setItem(BREAKER_KEY, String(disabledUntil));
    } catch {
      // ignore
    }
  }
}

export function overpassAvailable(): boolean {
  return Date.now() >= disabledUntil;
}

/** Landuse & settlement verification with a strict timeout and graceful fallback. */
export async function checkIdentifiability(
  point: LatLng,
  archetype: Archetype,
  { timeoutMs = OVERPASS_TIMEOUT_MS, signal }: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<IdentifiabilityVerdict> {
  if (!overpassAvailable()) return DEGRADED;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams({ data: buildOverpassQuery(point) }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      recordOverpassResult(false);
      return DEGRADED;
    }
    const json = (await res.json()) as { elements?: OsmElement[] };
    recordOverpassResult(true);
    return classifyOsm(json.elements ?? [], archetype);
  } catch {
    if (!signal?.aborted) recordOverpassResult(false);
    return DEGRADED;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export interface LuminanceStats {
  mean: number;
  stdDev: number;
}

export function luminanceStats(rgba: ArrayLike<number>): LuminanceStats {
  let sum = 0, sumSq = 0, n = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const y = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    sum += y;
    sumSq += y * y;
    n++;
  }
  if (n === 0) return { mean: 0, stdDev: 0 };
  const mean = sum / n;
  return { mean, stdDev: Math.sqrt(Math.max(0, sumSq / n - mean * mean)) };
}

/** Rejects black/near-black, blown-out or flat (blank/corrupt) frames. */
export function isUsableExposure({ mean, stdDev }: LuminanceStats): boolean {
  return mean >= 30 && mean <= 240 && stdDev >= 12;
}

/** Image Quality Guard: the image must load, be large enough and be properly exposed. */
export function checkImageQuality(url: string, { minWidth = 640, timeoutMs = 8000 } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    const timer = setTimeout(() => done(false), timeoutMs);
    function done(ok: boolean) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      resolve(ok);
    }
    img.onload = () => {
      if (img.naturalWidth < minWidth) return done(false);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return done(true);
        ctx.drawImage(img, 0, 0, 32, 32);
        done(isUsableExposure(luminanceStats(ctx.getImageData(0, 0, 32, 32).data)));
      } catch {
        // Tainted canvas (no CORS): the image loaded, so accept it.
        done(true);
      }
    };
    img.onerror = () => done(false);
    img.src = url;
  });
}

/** Road connectivity: outdoor panoramas must link to at least one neighbour. */
export function hasRoadConnectivity(links: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(links) && links.length >= 1;
}
