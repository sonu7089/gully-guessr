import { MAX_ROUND_SCORE } from '../config';
import type { LatLng } from '../engine/types';

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export const INDIA_BOUNDS: Bounds = { south: 6.5, west: 68, north: 36, east: 97.5 };

export function boundsDiagonalKm(b: Bounds): number {
  return haversineKm({ lat: b.south, lng: b.west }, { lat: b.north, lng: b.east });
}

/** ≈ 4,450 km — the All India map size. */
export const INDIA_SIZE_KM = boundsDiagonalKm(INDIA_BOUNDS);

/** A guess within 0.025% of the map size (1.1 km across India, 25 m minimum) scores full marks. */
export function perfectRadiusKm(sizeKm: number): number {
  return Math.max(0.025, sizeKm * 0.00025);
}

/**
 * Map-size-relative score: 5000 · e^(−10 · d / size), the same shape GeoGuessr uses.
 * Missing by 10% of the play area's diagonal leaves ~1,840 pts, whether that's
 * 445 km across India, 60 km in Kerala or 3.7 km in Bengaluru.
 */
export function scoreForDistance(distanceKm: number | null | undefined, sizeKm = INDIA_SIZE_KM): number {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm <= perfectRadiusKm(sizeKm)) return MAX_ROUND_SCORE;
  const raw = Math.round(MAX_ROUND_SCORE * Math.exp((-10 * distanceKm) / sizeKm));
  return Math.min(MAX_ROUND_SCORE, Math.max(0, raw));
}

export function formatDistance(distanceKm: number | null | undefined): string {
  if (distanceKm == null) return 'No guess';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  if (distanceKm < 100) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm).toLocaleString('en-IN')} km`;
}

/** Zero-padded points, e.g. 4820 → "04,820". */
export function formatPoints(points: number, pad = 5): string {
  const s = String(Math.max(0, Math.round(points))).padStart(pad, '0');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatScore(points: number): string {
  return Math.round(points).toLocaleString('en-US');
}

export interface RankTier {
  min: number;
  title: string;
}

export const RANK_TIERS: RankTier[] = [
  { min: 23500, title: 'Human GPS' },
  { min: 20000, title: 'Bharat Darshan Pro' },
  { min: 15000, title: 'Highway Dhaba Regular' },
  { min: 10000, title: 'Auto-wala in Training' },
  { min: 5000, title: 'Weekend Wanderer' },
  { min: 0, title: 'Lost Tourist' },
];

export function rankForScore(total: number): string {
  return (RANK_TIERS.find((t) => total >= t.min) ?? RANK_TIERS[RANK_TIERS.length - 1]).title;
}
