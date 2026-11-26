import { describe, expect, it } from 'vitest';
import { formatDistance, formatPoints, haversineKm, INDIA_SIZE_KM, perfectRadiusKm, rankForScore, scoreForDistance } from './scoring';

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 28.6139, lng: 77.209 }, { lat: 28.6139, lng: 77.209 })).toBe(0);
  });

  it('matches known Indian city distances', () => {
    const delhi = { lat: 28.6139, lng: 77.209 };
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const chennai = { lat: 13.0827, lng: 80.2707 };
    expect(haversineKm(delhi, mumbai)).toBeCloseTo(1153, -1);
    expect(haversineKm(delhi, chennai)).toBeCloseTo(1757, -1);
  });

  it('is symmetric', () => {
    const a = { lat: 34.1526, lng: 77.5771 };
    const b = { lat: 8.0883, lng: 77.5385 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 9);
  });
});

describe('scoreForDistance', () => {
  it('sizes the All India map at ~4,450 km', () => {
    expect(INDIA_SIZE_KM).toBeGreaterThan(4400);
    expect(INDIA_SIZE_KM).toBeLessThan(4500);
  });

  it('awards a perfect 5,000 inside the size-relative radius', () => {
    expect(scoreForDistance(0)).toBe(5000);
    expect(scoreForDistance(perfectRadiusKm(INDIA_SIZE_KM))).toBe(5000);
    expect(perfectRadiusKm(INDIA_SIZE_KM)).toBeCloseTo(1.11, 1);
    expect(perfectRadiusKm(30)).toBe(0.025);
  });

  it('follows the All India calibration points', () => {
    expect(scoreForDistance(10)).toBeCloseTo(4889, -1);
    expect(scoreForDistance(100)).toBeCloseTo(3993, -1);
    expect(scoreForDistance(500)).toBeCloseTo(1624, -1);
    expect(scoreForDistance(1000)).toBeCloseTo(528, -1);
  });

  it('scales with the play area so the same relative miss scores the same', () => {
    const india = scoreForDistance(INDIA_SIZE_KM * 0.1);
    expect(scoreForDistance(60, 600)).toBe(india);
    expect(scoreForDistance(3.7, 37)).toBe(india);
    expect(india).toBeCloseTo(1839, -1);
  });

  it('is much stricter in a city than across India for the same distance', () => {
    expect(scoreForDistance(2)).toBeGreaterThan(4900);
    expect(scoreForDistance(2, 37)).toBeLessThan(3000);
  });

  it('never goes negative and handles missing guesses', () => {
    expect(scoreForDistance(20000)).toBe(0);
    expect(scoreForDistance(null)).toBe(0);
    expect(scoreForDistance(-5)).toBe(0);
    expect(scoreForDistance(Number.NaN)).toBe(0);
  });
});

describe('formatting', () => {
  it('formats distances in metres and kilometres', () => {
    expect(formatDistance(0.32)).toBe('320 m');
    expect(formatDistance(48.24)).toBe('48.2 km');
    expect(formatDistance(null)).toBe('No guess');
  });

  it('zero-pads HUD points', () => {
    expect(formatPoints(4820)).toBe('04,820');
    expect(formatPoints(21480)).toBe('21,480');
  });

  it('maps totals to rank titles', () => {
    expect(rankForScore(24000)).toBe('Human GPS');
    expect(rankForScore(21480)).toBe('Bharat Darshan Pro');
    expect(rankForScore(0)).toBe('Lost Tourist');
  });
});
