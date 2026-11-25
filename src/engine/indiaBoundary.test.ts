import { describe, expect, it } from 'vitest';
import { isInIndia, isInOrNearIndia } from './geo';

describe('India point-in-polygon boundary', () => {
  it.each([
    ['Mumbai', 19.076, 72.8777],
    ['Kochi', 9.9816, 76.2999],
    ['Leh', 34.1526, 77.5771],
    ['Chennai', 13.0827, 80.2707],
    ['Amritsar', 31.634, 74.8723],
    ['Agartala', 23.8315, 91.2868],
    ['Port Blair', 11.6234, 92.7265],
    ['Kanyakumari', 8.0883, 77.5385],
    ['Jaisalmer', 26.9157, 70.9083],
  ])('accepts %s', (_name, lat, lng) => {
    expect(isInIndia({ lat, lng })).toBe(true);
  });

  it.each([
    ['Arabian Sea', 15.0, 68.0],
    ['Bay of Bengal', 15.0, 87.0],
    ['Indian Ocean south of Sri Lanka', 5.0, 80.0],
    ['Lahore, Pakistan', 31.5204, 74.3587],
    ['Kathmandu, Nepal', 27.7172, 85.324],
    ['Dhaka, Bangladesh', 23.8103, 90.4125],
    ['Colombo, Sri Lanka', 6.9271, 79.8612],
    ['Lhasa, China', 29.652, 91.1721],
  ])('rejects %s', (_name, lat, lng) => {
    expect(isInIndia({ lat, lng })).toBe(false);
  });

  it('tolerates seafront points just off the simplified coastline but not open sea', () => {
    expect(isInOrNearIndia({ lat: 18.9432, lng: 72.8231 })).toBe(true); // Marine Drive, Mumbai
    expect(isInOrNearIndia({ lat: 15.0, lng: 68.0 })).toBe(false);
    expect(isInOrNearIndia({ lat: 15.0, lng: 87.0 })).toBe(false);
  });
});
