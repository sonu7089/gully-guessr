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

export const PERFECT_THRESHOLD_KM = 0.15;
export const SCORE_DECAY_KM = 650;

/** India-calibrated score curve: 5,000 within 150 m, then exponential decay. */
export function scoreForDistance(distanceKm: number | null | undefined): number {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm <= PERFECT_THRESHOLD_KM) return MAX_ROUND_SCORE;
  const raw = Math.round(MAX_ROUND_SCORE * Math.exp(-distanceKm / SCORE_DECAY_KM));
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
  { min: 23500, title: 'Subcontinent Cartographer' },
  { min: 20000, title: 'Highway Veteran' },
  { min: 15000, title: 'Local Navigator' },
  { min: 10000, title: 'Weekend Wanderer' },
  { min: 5000, title: 'Curious Traveller' },
  { min: 0, title: 'First-Time Explorer' },
];

export function rankForScore(total: number): string {
  return (RANK_TIERS.find((t) => total >= t.min) ?? RANK_TIERS[RANK_TIERS.length - 1]).title;
}
