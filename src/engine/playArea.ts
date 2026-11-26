import { MIN_ROUND_SEPARATION_KM } from '../config';
import { INDIA_ANCHORS } from '../data/indiaAnchors';
import { INDIA_BOUNDARY, type Ring } from '../data/indiaBoundary';
import { CITY_BY_ID, INDIA_CITIES, type CityInfo } from '../data/indiaCities';
import { INDIA_STATES, STATE_CODES } from '../data/indiaStateClues';
import { boundsDiagonalKm, haversineKm, INDIA_BOUNDS, type Bounds } from '../utils/scoring';
import { indexRings, inOrNearRings, inRings, isInIndia, isInOrNearIndia, polarJitter } from './geo';
import { filterAnchorsByPack, generateCandidate, REGION_PACKS } from './locationGenerator';
import { defaultRng, type Rng } from './random';
import type { Anchor, GameScope, GameSettings, LatLng, LocationCandidate, RegionPack, StateCode } from './types';

export interface AreaGenerateOptions {
  rng?: Rng;
  previous: readonly LatLng[];
  recentAnchorIds?: readonly string[];
}

/** Everything that changes between an All India, a state and a city game. */
export interface PlayArea {
  scope: GameScope;
  label: string;
  /** Map frame shown before a pin is placed. */
  bounds: Bounds;
  /** [lng, lat] rings outlining the play area on the maps; empty for cities, which are framed by zoom alone. */
  outline: readonly Ring[];
  /** Diagonal of the play area in km; the score curve scales with it. */
  sizeKm: number;
  minSeparationKm: number;
  /** Imagery snap distance (km). Country/state play tolerates 3 km; inside a city it stays tight. */
  searchKm: number;
  stateCode: StateCode | null;
  pack: RegionPack;
  contains(p: LatLng): boolean;
  generate(opts: AreaGenerateOptions): LocationCandidate;
}

type StateShape = { bbox: [number, number, number, number]; rings: [number, number][][] };
export type StateShapes = Record<StateCode, StateShape>;

/** Lakshadweep has next to no street-level imagery, so it isn't offered as a state game. */
export const PLAYABLE_STATES: StateCode[] = STATE_CODES.filter((c) => c !== 'LD');

/** Share of state-game candidates sampled uniformly inside the state rather than around anchors. */
const STATE_UNIFORM_SHARE = 0.3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const farEnough = (p: LatLng, previous: readonly LatLng[], minKm: number) => previous.every((q) => haversineKm(p, q) >= minKm);

/** Rounds are spread across ~6% of the play area's diagonal, capped at the India-wide 35 km. */
export const separationFor = (diagonalKm: number) => clamp(diagonalKm * 0.06, 0.8, MIN_ROUND_SEPARATION_KM);

function boundsOfPoints(points: readonly LatLng[], padDeg: number): Bounds {
  let south = 90, west = 180, north = -90, east = -180;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south: south - padDeg, west: west - padDeg, north: north + padDeg, east: east + padDeg };
}

export function indiaArea(pack: RegionPack): PlayArea {
  const bounds = pack === 'all' || pack === 'metro' ? INDIA_BOUNDS : boundsOfPoints(filterAnchorsByPack(pack), 1);
  return {
    scope: 'india',
    label: REGION_PACKS.find((p) => p.id === pack)?.short ?? 'All India',
    bounds,
    outline: INDIA_BOUNDARY,
    sizeKm: boundsDiagonalKm(bounds),
    minSeparationKm: MIN_ROUND_SEPARATION_KM,
    searchKm: 3,
    stateCode: null,
    pack,
    contains: (p) => isInOrNearIndia(p),
    generate: ({ rng, previous, recentAnchorIds }) => generateCandidate({ pack, rng, previous, recentAnchorIds }),
  };
}

export function stateArea(code: StateCode, shape: StateShape): PlayArea {
  const [south, west, north, east] = shape.bbox;
  const bounds = { south, west, north, east };
  const diagonal = boundsDiagonalKm(bounds);
  const rings = indexRings(shape.rings);
  const contains = (p: LatLng) => inOrNearRings(p, rings, 1);
  const minSeparationKm = separationFor(diagonal);
  const anchors = INDIA_ANCHORS.filter((a) => a.state === code);
  const name = INDIA_STATES[code].name;
  const stateAnchor: Anchor = {
    id: `state-${code.toLowerCase()}`,
    name,
    state: code,
    lat: (south + north) / 2,
    lng: (west + east) / 2,
    archetype: 'rural_settlement',
    jitterRadiusKm: 0,
  };
  return {
    scope: 'state',
    label: name,
    bounds,
    outline: shape.rings,
    sizeKm: Math.max(40, diagonal),
    minSeparationKm,
    searchKm: clamp(diagonal / 100, 0.5, 3),
    stateCode: code,
    pack: 'all',
    contains,
    generate: ({ rng = defaultRng, previous, recentAnchorIds }) => {
      if (rng() < STATE_UNIFORM_SHARE) {
        for (let i = 0; i < 40; i++) {
          const p = { lat: south + rng() * (north - south), lng: west + rng() * (east - west) };
          if (inRings(p, rings) && isInIndia(p) && farEnough(p, previous, minSeparationKm)) return { ...p, anchor: stateAnchor, archetype: 'rural_settlement' };
        }
      }
      return generateCandidate({ pack: 'all', anchors, rng, previous, recentAnchorIds, minSeparationKm, accept: contains });
    },
  };
}

export function cityArea(city: CityInfo): PlayArea {
  const center = { lat: city.lat, lng: city.lng };
  const r = city.radiusKm;
  const dLat = r / 110.57;
  const dLng = r / (111.32 * Math.cos((city.lat * Math.PI) / 180));
  const bounds = { south: city.lat - dLat, west: city.lng - dLng, north: city.lat + dLat, east: city.lng + dLng };
  const diagonal = boundsDiagonalKm(bounds);
  const minSeparationKm = separationFor(diagonal);
  const anchor: Anchor = { id: `city-${city.id}`, name: city.name, state: city.state, ...center, archetype: 'urban_town', jitterRadiusKm: r };
  return {
    scope: 'city',
    label: city.name,
    bounds,
    outline: [],
    sizeKm: Math.max(15, diagonal),
    minSeparationKm,
    searchKm: clamp(r / 12, 0.4, 1),
    stateCode: city.state,
    pack: 'all',
    contains: (p) => haversineKm(p, center) <= r * 1.1 && isInOrNearIndia(p),
    generate: ({ rng = defaultRng, previous }) => {
      let p = center;
      for (let i = 0; i < 30; i++) {
        p = polarJitter(center, r, rng);
        if (isInIndia(p) && farEnough(p, previous, minSeparationKm)) break;
      }
      return { ...p, anchor, archetype: 'urban_town' };
    },
  };
}

let shapes: Promise<StateShapes> | null = null;
/** State boundaries are ~200 KB, so they load only when a state game starts. */
export function loadStateShapes(): Promise<StateShapes> {
  shapes ??= import('../data/stateShapes.json').then((m) => m.default as unknown as StateShapes);
  return shapes;
}

export async function resolvePlayArea(settings: GameSettings): Promise<PlayArea> {
  if (settings.scope === 'state') return stateArea(settings.state, (await loadStateShapes())[settings.state]);
  if (settings.scope === 'city') return cityArea(CITY_BY_ID[settings.city] ?? INDIA_CITIES[0]);
  return indiaArea(settings.pack);
}

/** Display name for a game's play area; tolerates settings saved before scopes existed. */
export function playAreaLabel(settings: Partial<GameSettings>): string {
  if (settings.scope === 'state' && settings.state && INDIA_STATES[settings.state]) return INDIA_STATES[settings.state].name;
  if (settings.scope === 'city' && settings.city && CITY_BY_ID[settings.city]) return CITY_BY_ID[settings.city].name;
  return REGION_PACKS.find((p) => p.id === settings.pack)?.short ?? 'All India';
}
