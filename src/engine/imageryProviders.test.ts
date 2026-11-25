import { describe, expect, it } from 'vitest';
import { poolForPack, scoreCommonsPage, type CommonsPage } from './imageryProviders';
import { INDIA_STATES } from '../data/indiaStateClues';

function page(title: string, opts: Partial<{ lat: number; lon: number; width: number; height: number; mime: string; categories: string; license: string }> = {}): CommonsPage {
  const { lat = 26.9124, lon = 75.7873, width = 2000, height = 1333, mime = 'image/jpeg', categories = '', license = 'CC BY-SA 4.0' } = opts;
  return {
    title: `File:${title}`,
    coordinates: [{ lat, lon }],
    imageinfo: [
      {
        url: 'https://upload.wikimedia.org/x.jpg',
        thumburl: 'https://upload.wikimedia.org/thumb/x.jpg',
        width,
        height,
        mime,
        extmetadata: { Categories: { value: categories }, LicenseShortName: { value: license } },
      },
    ],
  };
}

describe('scoreCommonsPage (Open Mode street filter)', () => {
  it('accepts a street scene inside India as a flat photo', () => {
    const r = scoreCommonsPage(page('Johari Bazaar street, Jaipur.jpg'));
    expect(r?.scene.kind).toBe('photo');
    expect(r?.score).toBeGreaterThan(0);
  });

  it('rejects people, food and interior shots even when they mention a road', () => {
    expect(scoreCommonsPage(page('Two boys posing on the road.jpg'))).toBeNull();
    expect(scoreCommonsPage(page('Thali at a market restaurant.jpg'))).toBeNull();
    expect(scoreCommonsPage(page('Temple interior near the bazaar.jpg'))).toBeNull();
  });

  it('rejects files that are not described as street-level scenes', () => {
    expect(scoreCommonsPage(page('IMG_2041.jpg'))).toBeNull();
    expect(scoreCommonsPage(page('IMG_2041.jpg', { categories: 'Streets in Jaipur' }))).not.toBeNull();
  });

  it('rejects non-free licences, tiny/portrait images and points outside India', () => {
    expect(scoreCommonsPage(page('Main road.jpg', { license: 'All rights reserved' }))).toBeNull();
    expect(scoreCommonsPage(page('Main road.jpg', { width: 800, height: 1200 }))).toBeNull();
    expect(scoreCommonsPage(page('Main road.jpg', { lat: 31.5204, lon: 74.3587 }))).toBeNull(); // Lahore
  });

  it('treats large 2:1 spherical images as 360° panoramas', () => {
    const r = scoreCommonsPage(page('360 panorama of MG Road.jpg', { width: 6000, height: 3000 }));
    expect(r?.scene.kind).toBe('equirect');
  });
});

describe('fallback pool', () => {
  it('has 40+ verified images and every regional pack can draw from it', () => {
    expect(poolForPack('all').length).toBeGreaterThanOrEqual(40);
    for (const pack of ['north', 'south', 'west', 'east', 'metro'] as const) {
      const pool = poolForPack(pack);
      expect(pool.length, pack).toBeGreaterThan(0);
      if (pack !== 'metro') expect(pool.every((p) => INDIA_STATES[p.state].region === pack)).toBe(true);
    }
  });
});
