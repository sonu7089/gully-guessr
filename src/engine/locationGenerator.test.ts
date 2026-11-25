import { describe, expect, it } from 'vitest';
import { INDIA_ANCHORS } from '../data/indiaAnchors';
import { INDIA_STATES, STATE_CODES } from '../data/indiaStateClues';
import { haversineKm } from '../utils/scoring';
import { isInIndia, polarJitter } from './geo';
import {
  ARCHETYPE_WEIGHTS,
  filterAnchorsByPack,
  generateCandidate,
  rollArchetype,
  stateWeight,
} from './locationGenerator';
import { mulberry32 } from './random';
import type { Archetype, LatLng, RegionPack } from './types';

describe('archetype Monte Carlo distribution', () => {
  it('weights sum to 100% with forest at 1.5%', () => {
    const total = Object.values(ARCHETYPE_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(100, 9);
    expect(ARCHETYPE_WEIGHTS.forest_wilderness).toBe(1.5);
  });

  it.each([1, 42, 2026])('10,000 rolls keep forest strictly within 1.0–2.0% (seed %i)', (seed) => {
    const rng = mulberry32(seed);
    const counts: Record<Archetype, number> = {
      urban_town: 0, highway_corridor: 0, rural_settlement: 0, scenic_coastal_hill: 0, forest_wilderness: 0,
    };
    const N = 10_000;
    for (let i = 0; i < N; i++) counts[rollArchetype(rng)]++;

    const forestShare = counts.forest_wilderness / N;
    expect(forestShare).toBeGreaterThan(0.01);
    expect(forestShare).toBeLessThan(0.02);
    const identifiable = (N - counts.forest_wilderness) / N;
    expect(identifiable).toBeGreaterThan(0.98);
    expect(identifiable).toBeLessThan(0.99);
    expect(counts.urban_town / N).toBeCloseTo(0.45, 1);
    expect(counts.highway_corridor / N).toBeCloseTo(0.285, 1);
  });

  it('end-to-end candidates for All India keep forest within 10–20 per 1,000', () => {
    const rng = mulberry32(7);
    let forest = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) if (generateCandidate({ pack: 'all', rng }).archetype === 'forest_wilderness') forest++;
    expect(forest / N).toBeGreaterThanOrEqual(0.01);
    expect(forest / N).toBeLessThanOrEqual(0.02);
  });
});

describe('India anchor atlas', () => {
  it('covers all 28 States and 8 UTs', () => {
    const states = Object.values(INDIA_STATES);
    expect(states.filter((s) => s.kind === 'state')).toHaveLength(28);
    expect(states.filter((s) => s.kind === 'ut')).toHaveLength(8);
    const covered = new Set(INDIA_ANCHORS.map((a) => a.state));
    for (const code of STATE_CODES) expect(covered.has(code), code).toBe(true);
  });

  it('has 250+ anchors with unique ids and 15–20 forest corridors', () => {
    expect(INDIA_ANCHORS.length).toBeGreaterThanOrEqual(250);
    expect(new Set(INDIA_ANCHORS.map((a) => a.id)).size).toBe(INDIA_ANCHORS.length);
    const forest = INDIA_ANCHORS.filter((a) => a.archetype === 'forest_wilderness').length;
    expect(forest).toBeGreaterThanOrEqual(15);
    expect(forest).toBeLessThanOrEqual(20);
  });

  it('places every anchor on the Indian landmass', () => {
    const outside = INDIA_ANCHORS.filter((a) => !isInIndia(a)).map((a) => a.id);
    expect(outside).toEqual([]);
  });
});

describe('dampened state weighting', () => {
  it('compresses population differences but keeps big states ahead', () => {
    expect(stateWeight('UP')).toBeGreaterThan(stateWeight('SK'));
    expect(stateWeight('UP') / stateWeight('SK')).toBeLessThan(5);
    expect(INDIA_STATES.UP.populationM / INDIA_STATES.SK.populationM).toBeGreaterThan(300);
  });

  it('gives Northeast states a regular share of All India rounds', () => {
    const rng = mulberry32(99);
    const ne = new Set(['AR', 'AS', 'MN', 'ML', 'MZ', 'NL', 'SK', 'TR']);
    let hits = 0;
    const N = 5000;
    for (let i = 0; i < N; i++) if (ne.has(generateCandidate({ pack: 'all', rng }).anchor.state)) hits++;
    expect(hits / N).toBeGreaterThan(0.07);
  });
});

describe('coordinate jitter + boundary guard', () => {
  it('spreads points evenly within the radius', () => {
    const rng = mulberry32(3);
    const c = { lat: 23.2599, lng: 77.4126 };
    let inner = 0;
    for (let i = 0; i < 4000; i++) {
      const p = polarJitter(c, 10, rng);
      const d = haversineKm(c, p);
      expect(d).toBeLessThanOrEqual(10.001);
      if (d <= 10 / Math.SQRT2) inner++;
    }
    // Uniform-by-area: half of the points fall inside r/√2.
    expect(inner / 4000).toBeGreaterThan(0.45);
    expect(inner / 4000).toBeLessThan(0.55);
  });

  it('never emits candidates in the sea or abroad for coastal & border anchors', () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 3000; i++) {
      const c = generateCandidate({ pack: 'all', rng });
      expect(isInIndia(c), `${c.anchor.id} ${c.lat},${c.lng}`).toBe(true);
    }
  });
});

describe('region packs & non-repeating rounds', () => {
  const packs: RegionPack[] = ['north', 'south', 'west', 'east'];

  it.each(packs)('filters anchors to the %s pack', (pack) => {
    const pool = filterAnchorsByPack(pack);
    expect(pool.length).toBeGreaterThan(20);
    expect(pool.every((a) => INDIA_STATES[a.state].region === pack)).toBe(true);
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i++) expect(INDIA_STATES[generateCandidate({ pack, rng }).anchor.state].region).toBe(pack);
  });

  it('Metro Cities pack only uses metro neighbourhoods and urban rolls', () => {
    const rng = mulberry32(8);
    for (let i = 0; i < 300; i++) {
      const c = generateCandidate({ pack: 'metro', rng });
      expect(c.anchor.metro).toBe(true);
      expect(c.archetype).toBe('urban_town');
    }
  });

  it.each(['all', ...packs, 'metro'] as RegionPack[])('keeps 5-round games ≥ 35 km apart (%s)', (pack) => {
    const rng = mulberry32(1234);
    for (let game = 0; game < 40; game++) {
      const chosen: LatLng[] = [];
      for (let r = 0; r < 5; r++) chosen.push(generateCandidate({ pack, rng, previous: chosen }));
      for (let i = 0; i < chosen.length; i++)
        for (let j = i + 1; j < chosen.length; j++) expect(haversineKm(chosen[i], chosen[j])).toBeGreaterThanOrEqual(35);
    }
  });

  it('avoids recently used anchors when alternatives exist', () => {
    const rng = mulberry32(21);
    const recent = filterAnchorsByPack('south').filter((a) => a.archetype === 'urban_town').map((a) => a.id).slice(0, 20);
    for (let i = 0; i < 200; i++) {
      const c = generateCandidate({ pack: 'south', rng, recentAnchorIds: recent, archetype: 'urban_town' });
      expect(recent).not.toContain(c.anchor.id);
    }
  });
});
