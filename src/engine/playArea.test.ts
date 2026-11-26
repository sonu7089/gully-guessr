import { describe, expect, it } from 'vitest';
import { INDIA_ANCHORS } from '../data/indiaAnchors';
import { CITY_BY_ID, INDIA_CITIES } from '../data/indiaCities';
import shapesJson from '../data/stateShapes.json';
import { haversineKm, INDIA_SIZE_KM } from '../utils/scoring';
import { cityArea, indiaArea, PLAYABLE_STATES, stateArea, type StateShapes } from './playArea';
import { mulberry32 } from './random';

const shapes = shapesJson as unknown as StateShapes;

describe('play areas', () => {
  it('All India uses the full-country size', () => {
    expect(indiaArea('all').sizeKm).toBeCloseTo(INDIA_SIZE_KM, 3);
    expect(indiaArea('south').sizeKm).toBeLessThan(INDIA_SIZE_KM);
  });

  it('every playable state has a boundary that contains most of its anchors', () => {
    for (const code of PLAYABLE_STATES) {
      expect(shapes[code], code).toBeTruthy();
      const area = stateArea(code, shapes[code]);
      const anchors = INDIA_ANCHORS.filter((a) => a.state === code);
      if (anchors.length === 0) continue;
      const inside = anchors.filter((a) => area.contains(a)).length;
      expect(inside / anchors.length, code).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('state rounds stay inside the state and apart from each other', () => {
    const area = stateArea('KL', shapes.KL);
    const rng = mulberry32(7);
    const previous: { lat: number; lng: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const c = area.generate({ rng, previous });
      expect(area.contains(c)).toBe(true);
      previous.forEach((p) => expect(haversineKm(p, c)).toBeGreaterThanOrEqual(area.minSeparationKm));
      previous.push(c);
    }
  });

  it('city rounds stay within the city radius', () => {
    const city = CITY_BY_ID.bengaluru;
    const area = cityArea(city);
    const rng = mulberry32(3);
    for (let i = 0; i < 20; i++) {
      const c = area.generate({ rng, previous: [] });
      expect(haversineKm(c, city)).toBeLessThanOrEqual(city.radiusKm + 0.01);
    }
    expect(area.sizeKm).toBeGreaterThan(30);
    expect(area.sizeKm).toBeLessThan(45);
    expect(area.searchKm).toBeLessThanOrEqual(1);
  });

  it('every city centre is on land in India', () => {
    for (const city of INDIA_CITIES) expect(cityArea(city).contains(city), city.id).toBe(true);
  });

  it('offers at least 100 distinct cities, each inside its own state', () => {
    expect(INDIA_CITIES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(INDIA_CITIES.map((c) => c.id)).size).toBe(INDIA_CITIES.length);
    for (const city of INDIA_CITIES) {
      const shape = shapes[city.state];
      expect(shape, city.id).toBeTruthy();
      expect(stateArea(city.state, shape).contains(city), `${city.id} in ${city.state}`).toBe(true);
    }
  });
});
