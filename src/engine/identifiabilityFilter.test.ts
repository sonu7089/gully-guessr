import { describe, expect, it } from 'vitest';
import { classifyOsm, isUsableExposure, luminanceStats, type OsmElement } from './identifiabilityFilter';

const forestArea: OsmElement = { type: 'area', tags: { landuse: 'forest' } };

describe('classifyOsm anti-forest rule', () => {
  it('rejects non-forest rolls that land purely inside forest', () => {
    const v = classifyOsm([forestArea, { type: 'way', tags: { highway: 'track' } }], 'urban_town');
    expect(v.accept).toBe(false);
    expect(v.inForest).toBe(true);
  });

  it('accepts forest-adjacent points with settlement signals', () => {
    const v = classifyOsm(
      [forestArea, { type: 'node', tags: { shop: 'convenience' } }, { type: 'node', tags: { place: 'village', name: 'Kumily' } }],
      'rural_settlement',
    );
    expect(v.accept).toBe(true);
    expect(v.settlement).toBe('Kumily');
  });

  it('always allows the forest_wilderness roll on a road', () => {
    const v = classifyOsm([forestArea, { type: 'way', tags: { highway: 'primary', ref: 'NH766' } }], 'forest_wilderness');
    expect(v.accept).toBe(true);
    expect(v.roadRef).toBe('NH766');
  });

  it('prefers the most important road for the clue card and scores identifiable scenes higher', () => {
    const busy = classifyOsm(
      [
        { type: 'way', tags: { highway: 'residential', name: 'Gandhi Road' } },
        { type: 'way', tags: { highway: 'trunk', ref: 'NH66', name: 'Mumbai–Goa Highway' } },
        { type: 'node', tags: { amenity: 'bank' } },
        { type: 'way', tags: { building: 'yes' } },
      ],
      'highway_corridor',
    );
    const sparse = classifyOsm([], 'highway_corridor');
    expect(busy.roadRef).toBe('NH66');
    expect(busy.score).toBeGreaterThan(sparse.score);
    expect(sparse.accept).toBe(true);
  });
});

describe('image quality guard', () => {
  const solid = (v: number) => new Array(32 * 32 * 4).fill(v).map((x, i) => (i % 4 === 3 ? 255 : x));

  it('rejects black and blank frames', () => {
    expect(isUsableExposure(luminanceStats(solid(0)))).toBe(false);
    expect(isUsableExposure(luminanceStats(solid(128)))).toBe(false);
  });

  it('accepts a normally exposed, textured frame', () => {
    const px = new Array(32 * 32 * 4).fill(0).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 200 + 30));
    expect(isUsableExposure(luminanceStats(px))).toBe(true);
  });
});
