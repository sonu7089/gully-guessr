import { INDIA_BOUNDARY, type Ring } from '../data/indiaBoundary';
import type { LatLng } from './types';

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export interface IndexedRing {
  ring: Ring;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Precompute ring bounding boxes so containment checks can skip far-away rings. */
export function indexRings(rings: ReadonlyArray<Ring>): IndexedRing[] {
  return rings.map((ring) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { ring, minX, maxX, minY, maxY };
  });
}

const INDEXED: IndexedRing[] = indexRings(INDIA_BOUNDARY);

/** Ray-casting point-in-polygon on a [lng, lat] ring. */
export function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inRings(p: LatLng, rings: readonly IndexedRing[]): boolean {
  for (const r of rings) {
    if (p.lng < r.minX || p.lng > r.maxX || p.lat < r.minY || p.lat > r.maxY) continue;
    if (pointInRing(p.lng, p.lat, r.ring)) return true;
  }
  return false;
}

/** True when the coordinate lies on the (simplified) Indian landmass, islands included. */
export function isInIndia(p: LatLng): boolean {
  return inRings(p, INDEXED);
}

/** Approximate distance (km) from a point to a ring edge, using a local equirectangular projection. */
function distanceToRingKm(p: LatLng, ring: Ring): number {
  const kx = 111.32 * Math.cos(toRad(p.lat));
  const ky = 110.57;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = (ring[j][0] - p.lng) * kx, ay = (ring[j][1] - p.lat) * ky;
    const bx = (ring[i][0] - p.lng) * kx, by = (ring[i][1] - p.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Like isInIndia, but tolerates points within `toleranceKm` of the simplified
 * coastline/boundary — real seafront panoramas often sit just outside a
 * ~1 km-resolution polygon.
 */
export function isInOrNearIndia(p: LatLng, toleranceKm = 1.5): boolean {
  return inOrNearRings(p, INDEXED, toleranceKm);
}

export function inOrNearRings(p: LatLng, rings: readonly IndexedRing[], toleranceKm: number): boolean {
  if (inRings(p, rings)) return true;
  const padLat = toleranceKm / 110;
  const padLng = toleranceKm / (111 * Math.cos(toRad(p.lat)));
  for (const r of rings) {
    if (p.lng < r.minX - padLng || p.lng > r.maxX + padLng || p.lat < r.minY - padLat || p.lat > r.maxY + padLat) continue;
    if (distanceToRingKm(p, r.ring) <= toleranceKm) return true;
  }
  return false;
}

/** A closed [lng, lat] ring approximating a circle, for outlining city play areas. */
export function circleRing(center: LatLng, radiusKm: number, segments = 72): Ring {
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const p = destinationPoint(center, (i / segments) * 360, radiusKm);
    ring.push([p.lng, p.lat]);
  }
  return ring;
}

/** Destination point given start, bearing (deg) and distance (km). */
export function destinationPoint(start: LatLng, bearingDeg: number, distanceKm: number): LatLng {
  const δ = distanceKm / EARTH_RADIUS_KM;
  const θ = toRad(bearingDeg);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lng);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

/**
 * Uniform random point within a disc: r = R·√u keeps density even across the
 * area instead of clumping near the centre.
 */
export function polarJitter(center: LatLng, radiusKm: number, rng: () => number): LatLng {
  const r = radiusKm * Math.sqrt(rng());
  const bearing = rng() * 360;
  return destinationPoint(center, bearing, r);
}

/** Intermediate points along the great circle between a and b (for dashed geodesic lines). */
export function greatCirclePath(a: LatLng, b: LatLng, segments = 48): [number, number][] {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lng), φ2 = toRad(b.lat), λ2 = toRad(b.lng);
  const d =
    2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d < 1e-9) return [[a.lat, a.lng], [b.lat, b.lng]];
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

export function formatCoord(p: LatLng, digits = 4): string {
  const lat = `${Math.abs(p.lat).toFixed(digits)}° ${p.lat >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(p.lng).toFixed(digits)}° ${p.lng >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}
