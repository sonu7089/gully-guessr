import { LOCATE_BATCH_SIZE, LOCATE_MAX_ATTEMPTS, MIN_ROUND_SEPARATION_KM } from '../config';
import { INDIA_STATES } from '../data/indiaStateClues';
import { haversineKm } from '../utils/scoring';
import { isInOrNearIndia } from './geo';
import { checkIdentifiability, type IdentifiabilityVerdict } from './identifiabilityFilter';
import { openProvider, pickFromFallbackPool, type ImageryProvider, type Scene } from './imageryProviders';
import { generateCandidate } from './locationGenerator';
import { defaultRng, type Rng } from './random';
import { reverseGeocode } from './reverseGeocode';
import type { Archetype, LatLng, LocationCandidate, RegionPack, StateCode } from './types';

export interface RevealedPlace {
  locality: string;
  district: string | null;
  stateCode: StateCode | null;
  stateName: string;
  road: string | null;
}

export interface PreparedRound {
  candidate: LocationCandidate | null;
  archetype: Archetype;
  scene: Scene;
  verdict: IdentifiabilityVerdict | null;
  attempts: number;
  usedFallback: boolean;
  /** Resolves with locality/state for the reveal screen (never rejects). */
  place: Promise<RevealedPlace>;
}

export interface PrepareOptions {
  provider: ImageryProvider;
  pack: RegionPack;
  previous: readonly LatLng[];
  recentAnchorIds?: readonly string[];
  excludeSceneIds?: ReadonlySet<string>;
  signal?: AbortSignal;
  rng?: Rng;
  maxAttempts?: number;
  batchSize?: number;
  /** Injection points for tests. */
  identify?: typeof checkIdentifiability;
}

interface Attempt {
  candidate: LocationCandidate;
  scene: Scene;
  verdict: IdentifiabilityVerdict;
}

function nearestKnownPlace(scene: Scene, candidate: LocationCandidate | null): RevealedPlace {
  if (scene.knownPlace) {
    return { locality: scene.knownPlace.name, district: null, stateCode: scene.knownPlace.state, stateName: INDIA_STATES[scene.knownPlace.state].name, road: null };
  }
  const a = candidate?.anchor;
  return {
    locality: a ? a.name.replace(/^(NH|SH)\S*\s+near\s+/i, '') : 'Somewhere in India',
    district: null,
    stateCode: a?.state ?? null,
    stateName: a ? INDIA_STATES[a.state].name : 'India',
    road: null,
  };
}

/** Step E: resolve the revealed place, falling back to anchor/pool metadata. */
export async function resolvePlace(scene: Scene, candidate: LocationCandidate | null, verdict: IdentifiabilityVerdict | null, signal?: AbortSignal): Promise<RevealedPlace> {
  const fallback = nearestKnownPlace(scene, candidate);
  const geo = await reverseGeocode(scene, { useGoogle: scene.provider === 'google', signal }).catch(() => null);
  const road = verdict?.roadRef ? verdict.roadRef.split(';')[0] : geo?.road ?? verdict?.roadName ?? null;
  if (!geo || geo.countryCode && geo.countryCode !== 'in') return { ...fallback, road };
  return {
    locality: geo.locality ?? verdict?.settlement ?? fallback.locality,
    district: geo.district,
    stateCode: geo.stateCode ?? fallback.stateCode,
    stateName: geo.stateName ?? fallback.stateName,
    road,
  };
}

async function tryCandidate(candidate: LocationCandidate, opts: PrepareOptions, provider: ImageryProvider): Promise<Attempt | null> {
  try {
    const scene = await provider.findScene(candidate, { signal: opts.signal, rng: opts.rng, excludeIds: opts.excludeSceneIds });
    if (!scene || opts.signal?.aborted) return null;
    if (!isInOrNearIndia(scene)) return null;
    if (!opts.previous.every((p) => haversineKm(p, scene) >= MIN_ROUND_SEPARATION_KM)) return null;
    const verdict = await (opts.identify ?? checkIdentifiability)(scene, candidate.archetype, { signal: opts.signal });
    if (!verdict.accept) return null;
    return { candidate, scene, verdict };
  } catch {
    return null;
  }
}

/**
 * Steps A–E for one round: concurrent batches of procedural candidates (up to
 * `maxAttempts`), best identifiability score wins, verified pool as fallback.
 */
export async function prepareRound(opts: PrepareOptions): Promise<PreparedRound> {
  const rng = opts.rng ?? defaultRng;
  const maxAttempts = opts.maxAttempts ?? LOCATE_MAX_ATTEMPTS;
  const batchSize = opts.batchSize ?? LOCATE_BATCH_SIZE;
  const queued: LatLng[] = [...opts.previous];
  let attempts = 0;
  let firstArchetype: Archetype | null = null;

  const runWith = async (provider: ImageryProvider, budget: number): Promise<Attempt | null> => {
    let used = 0;
    while (used < budget && !opts.signal?.aborted) {
      const n = Math.min(batchSize, budget - used);
      const batch: LocationCandidate[] = [];
      for (let i = 0; i < n; i++) {
        const c = generateCandidate({ pack: opts.pack, rng, previous: queued, recentAnchorIds: opts.recentAnchorIds });
        firstArchetype ??= c.archetype;
        batch.push(c);
      }
      used += n;
      attempts += n;
      const results = (await Promise.all(batch.map((c) => tryCandidate(c, opts, provider)))).filter((r): r is Attempt => !!r);
      if (results.length) return results.sort((a, b) => b.verdict.score - a.verdict.score)[0];
    }
    return null;
  };

  let best = await runWith(opts.provider, maxAttempts);
  if (!best && opts.provider.id !== 'open' && !opts.signal?.aborted) best = await runWith(openProvider, 2);

  if (best) {
    return {
      candidate: best.candidate,
      archetype: best.candidate.archetype,
      scene: best.scene,
      verdict: best.verdict,
      attempts,
      usedFallback: false,
      place: resolvePlace(best.scene, best.candidate, best.verdict, opts.signal),
    };
  }

  const scene = pickFromFallbackPool(opts.pack, { previous: opts.previous, excludeIds: opts.excludeSceneIds, rng });
  return {
    candidate: null,
    archetype: firstArchetype ?? 'urban_town',
    scene,
    verdict: null,
    attempts,
    usedFallback: true,
    place: resolvePlace(scene, null, null, opts.signal),
  };
}

/** Guess-side state lookup for the CORRECT STATE badge. */
export async function stateOfPoint(p: LatLng, useGoogle: boolean): Promise<StateCode | null> {
  if (!isInOrNearIndia(p, 3)) return null;
  const geo = await reverseGeocode(p, { useGoogle, zoom: 8 }).catch(() => null);
  return geo?.countryCode && geo.countryCode !== 'in' ? null : geo?.stateCode ?? null;
}
