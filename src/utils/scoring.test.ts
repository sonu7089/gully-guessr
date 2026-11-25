import { describe, expect, it } from 'vitest';
import { formatDistance, formatPoints, haversineKm, rankForScore, scoreForDistance } from './scoring';

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
  it('awards a perfect 5,000 within 150 m (inclusive)', () => {
    expect(scoreForDistance(0)).toBe(5000);
    expect(scoreForDistance(0.15)).toBe(5000);
  });

  it('decays just outside the perfect threshold', () => {
    expect(scoreForDistance(0.151)).toBe(4999);
  });

  it('follows the India calibration points', () => {
    expect(scoreForDistance(10)).toBe(4924);
    expect(scoreForDistance(100)).toBeCloseTo(4288, -1);
    expect(scoreForDistance(500)).toBeCloseTo(2315, -1);
    expect(scoreForDistance(1000)).toBeCloseTo(1073, -1);
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
    expect(rankForScore(24000)).toBe('Subcontinent Cartographer');
    expect(rankForScore(21480)).toBe('Highway Veteran');
    expect(rankForScore(0)).toBe('First-Time Explorer');
  });
});
