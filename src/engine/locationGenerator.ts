import { INDIA_ANCHORS } from '../data/indiaAnchors';
import { INDIA_STATES } from '../data/indiaStateClues';
import { MIN_ROUND_SEPARATION_KM } from '../config';
import { haversineKm } from '../utils/scoring';
import { isInIndia, polarJitter } from './geo';
import { defaultRng, pickOne, pickWeighted, type Rng } from './random';
import type { Anchor, Archetype, LatLng, LocationCandidate, RegionPack, StateCode } from './types';

/** Step A: archetype probabilities in percent (sum = 100). */
export const ARCHETYPE_WEIGHTS: Readonly<Record<Archetype, number>> = Object.freeze({
  urban_town: 45.0,
  highway_corridor: 28.5,
  rural_settlement: 18.0,
  scenic_coastal_hill: 7.0,
  forest_wilderness: 1.5,
});

export const ARCHETYPES = Object.keys(ARCHETYPE_WEIGHTS) as Archetype[];

export const ARCHETYPE_LABELS: Record<Archetype, string> = {
  urban_town: 'Urban town',
  highway_corridor: 'Highway corridor',
  rural_settlement: 'Rural settlement',
  scenic_coastal_hill: 'Coast, hills & heritage',
  forest_wilderness: 'Forest road',
};

export const REGION_PACKS: { id: RegionPack; label: string; short: string }[] = [
  { id: 'all', label: 'All India (28 States + 8 UTs)', short: 'All India' },
  { id: 'north', label: 'North & Himalayas', short: 'North & Himalayas' },
  { id: 'south', label: 'South India', short: 'South India' },
  { id: 'west', label: 'West & Coast', short: 'West & Coast' },
  { id: 'east', label: 'East & Northeast', short: 'East & Northeast' },
  { id: 'metro', label: 'Metro Cities', short: 'Metro Cities' },
];

export function rollArchetype(rng: Rng = defaultRng, weights: Partial<Record<Archetype, number>> = ARCHETYPE_WEIGHTS): Archetype {
  return pickWeighted(weights, rng);
}

export function filterAnchorsByPack(pack: RegionPack, anchors: readonly Anchor[] = INDIA_ANCHORS): Anchor[] {
  if (pack === 'all') return [...anchors];
  if (pack === 'metro') return anchors.filter((a) => a.metro);
  return anchors.filter((a) => INDIA_STATES[a.state].region === pack);
}

/**
 * Step B: square-root dampened state weight. Large states still appear more,
 * but far less than raw population would imply, and every state/UT has a floor.
 */
export function stateWeight(code: StateCode): number {
  const s = INDIA_STATES[code];
  const floor = s.kind === 'state' ? 2.2 : 1.2;
  return Math.min(9, Math.max(floor, Math.sqrt(s.populationM)));
}

/** Archetype weights restricted to those the pool can actually serve. */
export function effectiveArchetypeWeights(pool: readonly Anchor[], pack: RegionPack): Partial<Record<Archetype, number>> {
  if (pack === 'metro') return { urban_town: 100 };
  const present = new Set(pool.map((a) => a.archetype));
  const out: Partial<Record<Archetype, number>> = {};
  for (const a of ARCHETYPES) if (present.has(a)) out[a] = ARCHETYPE_WEIGHTS[a];
  return out;
}

export interface GenerateOptions {
  pack: RegionPack;
  rng?: Rng;
  /** Locations already used (or queued) in the current game. */
  previous?: readonly LatLng[];
  /** Anchor ids recently used across sessions; avoided when possible. */
  recentAnchorIds?: readonly string[];
  minSeparationKm?: number;
  anchors?: readonly Anchor[];
  /** Force an archetype (used by tests and retries). */
  archetype?: Archetype;
  /** Extra constraint on the jittered point, e.g. "inside this state". */
  accept?: (p: LatLng) => boolean;
}

function farEnough(p: LatLng, previous: readonly LatLng[], minKm: number): boolean {
  return previous.every((q) => haversineKm(p, q) >= minKm);
}

/** Pick an anchor for an archetype: dampened state roll, then uniform anchor within the state. */
export function pickAnchor(candidates: readonly Anchor[], rng: Rng): Anchor {
  const byState = new Map<StateCode, Anchor[]>();
  for (const a of candidates) {
    const list = byState.get(a.state);
    if (list) list.push(a);
    else byState.set(a.state, [a]);
  }
  const weights: Partial<Record<StateCode, number>> = {};
  for (const code of byState.keys()) weights[code] = stateWeight(code);
  const state = pickWeighted(weights, rng);
  return pickOne(byState.get(state)!, rng);
}

/** Step C: polar jitter around the anchor, guarded by the India landmass polygon. */
export function jitterWithinIndia(anchor: Anchor, rng: Rng, tries = 12): LatLng {
  let radius = anchor.jitterRadiusKm;
  for (let i = 0; i < tries; i++) {
    const p = polarJitter(anchor, radius, rng);
    if (isInIndia(p)) return p;
    if (i % 4 === 3) radius /= 2;
  }
  return { lat: anchor.lat, lng: anchor.lng };
}

/**
 * Generate one procedural candidate (Steps A–C). The separation rule is
 * progressively relaxed only if a pack is too small to satisfy it.
 */
export function generateCandidate(opts: GenerateOptions): LocationCandidate {
  const rng = opts.rng ?? defaultRng;
  const previous = opts.previous ?? [];
  const minKm = opts.minSeparationKm ?? MIN_ROUND_SEPARATION_KM;
  const recent = new Set(opts.recentAnchorIds ?? []);
  const pool = filterAnchorsByPack(opts.pack, opts.anchors);
  if (pool.length === 0) throw new Error(`No anchors for pack "${opts.pack}"`);

  const archetype = opts.archetype ?? rollArchetype(rng, effectiveArchetypeWeights(pool, opts.pack));
  const ofType = pool.filter((a) => a.archetype === archetype);
  const typed = ofType.length > 0 ? ofType : pool;

  const tiers: Anchor[][] = [
    typed.filter((a) => !recent.has(a.id) && farEnough(a, previous, minKm + a.jitterRadiusKm)),
    typed.filter((a) => farEnough(a, previous, minKm + a.jitterRadiusKm)),
    typed.filter((a) => farEnough(a, previous, minKm)),
    pool.filter((a) => farEnough(a, previous, minKm)),
    typed,
  ];
  const eligible = tiers.find((t) => t.length > 0)!;

  for (let attempt = 0; attempt < 6; attempt++) {
    const anchor = pickAnchor(eligible, rng);
    const point = jitterWithinIndia(anchor, rng);
    if ((farEnough(point, previous, minKm) && (opts.accept?.(point) ?? true)) || attempt === 5) {
      return { ...point, anchor, archetype };
    }
  }
  /* c8 ignore next */
  throw new Error('unreachable');
}
