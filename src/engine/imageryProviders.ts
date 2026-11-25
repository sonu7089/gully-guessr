import { FALLBACK_POOL, type PoolImage } from '../data/fallbackPool';
import { INDIA_STATES } from '../data/indiaStateClues';
import { haversineKm } from '../utils/scoring';
import { isInOrNearIndia } from './geo';
import { googleAuthFailed, loadGoogleMaps, streetViewLibrary } from './googleMaps';
import { checkImageQuality, hasRoadConnectivity } from './identifiabilityFilter';
import { defaultRng, pickOne, type Rng } from './random';
import type { Archetype, LatLng, LocationCandidate, RegionPack, StateCode } from './types';

export type ProviderId = 'google' | 'mapillary' | 'open';

export interface SceneAttribution {
  source: string;
  title?: string;
  author?: string;
  license?: string;
  url?: string;
}

export interface Scene extends LatLng {
  provider: ProviderId;
  /** google = live Street View, equirect = 360° image, photo = flat photograph. */
  kind: 'google' | 'equirect' | 'photo';
  /** Stable id used to avoid repeats (pano id, Mapillary id, Commons title). */
  id: string;
  heading: number | null;
  panoId?: string;
  imageUrl?: string;
  sequenceId?: string;
  attribution?: SceneAttribution;
  /** Known place metadata (fallback pool) used when reverse geocoding fails. */
  knownPlace?: { name: string; state: StateCode };
}

export interface FindContext {
  signal?: AbortSignal;
  rng?: Rng;
  excludeIds?: ReadonlySet<string>;
}

export interface ImageryProvider {
  id: ProviderId;
  label: string;
  /** Short explanation shown in the provider info chip. */
  description: string;
  supportsMovement: boolean;
  findScene(candidate: LocationCandidate, ctx?: FindContext): Promise<Scene | null>;
}

const env = import.meta.env ?? {};
export const GOOGLE_KEY = (env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
export const MAPILLARY_TOKEN = (env.VITE_MAPILLARY_ACCESS_TOKEN ?? '').trim();

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: 'Google Street View',
  mapillary: 'Mapillary 360°',
  open: 'Open Mode',
};

export function configuredProviderId(): ProviderId {
  if (GOOGLE_KEY) return 'google';
  if (MAPILLARY_TOKEN) return 'mapillary';
  return 'open';
}

/* ------------------------------------------------------------------ */
/* Tier 1 — Google Street View                                         */
/* ------------------------------------------------------------------ */

export const GOOGLE_RADII_M = [250, 1000, 3000];

export const googleProvider: ImageryProvider = {
  id: 'google',
  label: PROVIDER_LABELS.google,
  description: 'Live outdoor Street View with full 360° navigation.',
  supportsMovement: true,
  async findScene(candidate, ctx = {}) {
    await loadGoogleMaps(GOOGLE_KEY);
    const { StreetViewService, StreetViewSource, StreetViewPreference } = await streetViewLibrary();
    const service = new StreetViewService();
    for (const radius of GOOGLE_RADII_M) {
      if (ctx.signal?.aborted) return null;
      try {
        const { data } = await service.getPanorama({
          location: { lat: candidate.lat, lng: candidate.lng },
          radius,
          sources: [StreetViewSource.OUTDOOR],
          preference: StreetViewPreference.NEAREST,
        });
        const loc = data.location?.latLng;
        const panoId = data.location?.pano;
        const heading = data.tiles?.centerHeading;
        if (!loc || !panoId || typeof heading !== 'number') continue;
        if (!hasRoadConnectivity(data.links)) continue;
        if (ctx.excludeIds?.has(panoId)) continue;
        const p = { lat: loc.lat(), lng: loc.lng() };
        if (!isInOrNearIndia(p)) continue;
        return {
          ...p,
          provider: 'google',
          kind: 'google',
          id: panoId,
          panoId,
          heading,
          attribution: { source: 'Google Street View', title: data.copyright ?? undefined },
        };
      } catch {
        // ZERO_RESULTS at this radius — widen the search.
      }
    }
    return null;
  },
};

/* ------------------------------------------------------------------ */
/* Tier 2 — Mapillary 360°                                             */
/* ------------------------------------------------------------------ */

interface MapillaryImage {
  id: string;
  thumb_2048_url?: string;
  geometry?: { coordinates: [number, number] };
  computed_geometry?: { coordinates: [number, number] };
  compass_angle?: number;
  computed_compass_angle?: number;
  sequence?: string;
  is_pano?: boolean;
  creator?: { username?: string };
}

const MAPILLARY_FIELDS = 'id,thumb_2048_url,geometry,computed_geometry,compass_angle,computed_compass_angle,sequence,is_pano,creator';
export const MAPILLARY_BBOX_HALF_DEG = [0.003, 0.012, 0.03];

async function mapillaryJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function mapillaryScene(img: MapillaryImage): Scene | null {
  const coords = (img.computed_geometry ?? img.geometry)?.coordinates;
  if (!coords || !img.thumb_2048_url) return null;
  const heading = img.computed_compass_angle ?? img.compass_angle;
  return {
    lat: coords[1],
    lng: coords[0],
    provider: 'mapillary',
    kind: 'equirect',
    id: img.id,
    imageUrl: img.thumb_2048_url,
    sequenceId: img.sequence,
    heading: typeof heading === 'number' ? heading : null,
    attribution: {
      source: 'Mapillary',
      author: img.creator?.username,
      license: 'CC BY-SA 4.0',
      url: `https://www.mapillary.com/app/?pKey=${img.id}`,
    },
  };
}

export const mapillaryProvider: ImageryProvider = {
  id: 'mapillary',
  label: PROVIDER_LABELS.mapillary,
  description: 'Free crowd-sourced 360° panoramas with sequence stepping.',
  supportsMovement: true,
  async findScene(candidate, ctx = {}) {
    for (const half of MAPILLARY_BBOX_HALF_DEG) {
      if (ctx.signal?.aborted) return null;
      const bbox = [candidate.lng - half, candidate.lat - half, candidate.lng + half, candidate.lat + half].map((v) => v.toFixed(5)).join(',');
      const url = `https://graph.mapillary.com/images?access_token=${encodeURIComponent(MAPILLARY_TOKEN)}&fields=${MAPILLARY_FIELDS}&bbox=${bbox}&is_pano=true&limit=40`;
      const json = await mapillaryJson<{ data?: MapillaryImage[] }>(url, ctx.signal);
      const scenes = (json?.data ?? [])
        .filter((img) => img.sequence && !ctx.excludeIds?.has(img.id))
        .map(mapillaryScene)
        .filter((s): s is Scene => !!s && isInOrNearIndia(s))
        .sort((a, b) => haversineKm(a, candidate) - haversineKm(b, candidate));
      for (const scene of scenes.slice(0, 3)) {
        if (await checkImageQuality(scene.imageUrl!, { minWidth: 1024 })) return scene;
      }
    }
    return null;
  },
};

const sequenceCache = new Map<string, string[]>();

/** Step along the Mapillary capture sequence (Standard ruleset only). */
export async function stepMapillarySequence(scene: Scene, direction: 1 | -1): Promise<Scene | null> {
  if (!scene.sequenceId || !MAPILLARY_TOKEN) return null;
  let ids = sequenceCache.get(scene.sequenceId);
  if (!ids) {
    const json = await mapillaryJson<{ data?: { id: string }[] }>(
      `https://graph.mapillary.com/image_ids?access_token=${encodeURIComponent(MAPILLARY_TOKEN)}&sequence_id=${scene.sequenceId}`,
    );
    ids = (json?.data ?? []).map((d) => d.id);
    sequenceCache.set(scene.sequenceId, ids);
  }
  const idx = ids.indexOf(scene.id);
  const nextId = idx >= 0 ? ids[idx + direction] : undefined;
  if (!nextId) return null;
  const img = await mapillaryJson<MapillaryImage>(
    `https://graph.mapillary.com/${nextId}?access_token=${encodeURIComponent(MAPILLARY_TOKEN)}&fields=${MAPILLARY_FIELDS}`,
  );
  return img ? mapillaryScene(img) : null;
}

/* ------------------------------------------------------------------ */
/* Tier 3 — Open Mode (Wikimedia Commons, zero keys)                   */
/* ------------------------------------------------------------------ */

export const OPEN_KEYWORDS: Record<Archetype, string[]> = {
  urban_town: ['street', 'market', 'road', 'bazaar', 'chowk'],
  highway_corridor: ['highway', 'road', 'national highway'],
  rural_settlement: ['village', 'road', 'street'],
  scenic_coastal_hill: ['road', 'street', 'view'],
  forest_wilderness: ['forest road', 'road'],
};

const REJECT_RE =
  /\b(maps?|logo|diagram|chart|interior|inside|indoors?|museum|food|thali|dish|cuisine|sweets?|cloth|textiles?|sarees?|portrait|selfie|statues?|idols?|deity|paintings?|manuscript|inscriptions?|coins?|stamps?|flags?|emblem|seal|document|poster|insects?|butterfl\w+|birds?|flowers?|leaf|leaves|macro|close-?up|ceiling|night|sculptures?|carvings?|jewel\w*|wedding|dance|svg|plan|drawing|sketch|screenshot|graffiti|signboard|nameplate|plaque|meeting|conference|award|ceremony|stage|bedroom|kitchen|restaurant|exhibit\w*|artwork|mural|puja|pooja|altar|detail|people|persons?|man|men|woman|women|boys?|girls?|child|children|kids?|friends?|family|students?|couple|posing|climbing|cricket|match|rally|protest|crowd|cow|dog|cat|monkey|elephant|tiger|leopard|earth|iss\d*|satellite|astronaut|spacecraft)\b/i;
const BOOST_RE =
  /\b(street|streets|road|roads|highway|nh ?\d+|market|bazaar|bazar|chowk|junction|lane|town|village|city|view|skyline|bus stand|bridge|ghat|square|circle|crossing|marg|traffic|shops|avenue)\b/i;
const PANO_RE = /\b(360|equirectangular|spherical|photosphere|panorama)\b/i;

export interface CommonsPage {
  title: string;
  coordinates?: { lat: number; lon: number }[];
  imageinfo?: {
    url: string;
    thumburl?: string;
    width: number;
    height: number;
    mime: string;
    descriptionurl?: string;
    extmetadata?: Record<string, { value: string } | undefined>;
  }[];
}

const stripHtml = (s: string | undefined) => (s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/** Scores a Commons file for street-level playability. Returns null when unusable. */
export function scoreCommonsPage(page: CommonsPage): { scene: Scene; score: number } | null {
  const ii = page.imageinfo?.[0];
  const c = page.coordinates?.[0];
  if (!ii || !c || ii.mime !== 'image/jpeg') return null;
  const title = page.title.replace(/^File:/, '');
  if (REJECT_RE.test(title)) return null;
  const categories = stripHtml(ii.extmetadata?.Categories?.value);
  const license = stripHtml(ii.extmetadata?.LicenseShortName?.value);
  if (license && !/^(CC BY|CC-BY|CC0|Public domain|PD)/i.test(license)) return null;
  const aspect = ii.width / ii.height;
  const isPano = aspect > 1.95 && aspect < 2.05 && ii.width >= 3000 && ii.width <= 8192 && PANO_RE.test(`${title} ${categories}`);
  if (!isPano && (ii.width < 1000 || ii.height < 600 || aspect < 1.2 || aspect > 2.6)) return null;
  const p = { lat: c.lat, lng: c.lon };
  if (!isInOrNearIndia(p)) return null;
  const titleBoost = BOOST_RE.test(title);
  const categoryBoost = BOOST_RE.test(categories);
  // Street-level playability: the file must be described as a street/road/town scene.
  if (!titleBoost && !categoryBoost && !isPano) return null;
  const score = (titleBoost ? 3 : 0) + (categoryBoost ? 1 : 0) + (isPano ? 2 : 0) + (REJECT_RE.test(categories) ? -2 : 0);
  return {
    score,
    scene: {
      ...p,
      provider: 'open',
      kind: isPano ? 'equirect' : 'photo',
      id: title,
      imageUrl: isPano ? ii.url : ii.thumburl ?? ii.url,
      heading: null,
      attribution: {
        source: 'Wikimedia Commons',
        title,
        author: stripHtml(ii.extmetadata?.Artist?.value).slice(0, 80) || undefined,
        license: license || undefined,
        url: ii.descriptionurl,
      },
    },
  };
}

const COMMONS_MIN_INTERVAL_MS = 300;
const COMMONS_COOLDOWN_MS = 90_000;
const COMMONS_COOLDOWN_KEY = 'gullyguessr:commons-cooldown-until';
let commonsQueue: Promise<unknown> = Promise.resolve();
let commonsLast = 0;
let commonsCooldownUntil = (() => {
  try {
    return Number(globalThis.sessionStorage?.getItem(COMMONS_COOLDOWN_KEY)) || 0;
  } catch {
    return 0;
  }
})();
const commonsCache = new Map<string, Promise<CommonsPage[]>>();

/** True while Commons search is cooling down after a 429 — callers should use the local pool. */
export function commonsThrottled(): boolean {
  return Date.now() < commonsCooldownUntil;
}

function startCommonsCooldown(): void {
  commonsCooldownUntil = Date.now() + COMMONS_COOLDOWN_MS;
  try {
    globalThis.sessionStorage?.setItem(COMMONS_COOLDOWN_KEY, String(commonsCooldownUntil));
  } catch {
    // ignore
  }
}

/** One request at a time with polite spacing; CirrusSearch rate-limits anonymous bursts. */
function commonsRequest(url: string, signal?: AbortSignal): Promise<CommonsPage[]> {
  const run = commonsQueue.then(async () => {
    if (commonsThrottled() || signal?.aborted) return [];
    const wait = commonsLast + COMMONS_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    commonsLast = Date.now();
    try {
      const res = await fetch(url, { signal });
      if (res.status === 429) {
        startCommonsCooldown();
        return [];
      }
      if (!res.ok) return [];
      const json = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
      return Object.values(json.query?.pages ?? {});
    } catch {
      return [];
    }
  });
  commonsQueue = run.catch(() => undefined);
  return run;
}

function commonsSearch(keyword: string, p: LatLng, radiusKm: number, signal?: AbortSignal): Promise<CommonsPage[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '40',
    gsrsearch: `${keyword} nearcoord:${radiusKm}km,${p.lat.toFixed(3)},${p.lng.toFixed(3)}`,
    prop: 'imageinfo|coordinates',
    iiprop: 'url|size|mime|extmetadata',
    iiurlwidth: '1920',
    iiextmetadatafilter: 'Artist|LicenseShortName|Categories',
  });
  const url = `https://commons.wikimedia.org/w/api.php?${params}`;
  let hit = commonsCache.get(url);
  if (!hit) {
    hit = commonsRequest(url, signal);
    commonsCache.set(url, hit);
    hit.then((pages) => pages.length === 0 && commonsCache.delete(url));
  }
  return hit;
}

export const openProvider: ImageryProvider = {
  id: 'open',
  label: PROVIDER_LABELS.open,
  description: 'Zero-setup street photography from Wikimedia Commons, matched to procedurally sampled coordinates.',
  supportsMovement: false,
  async findScene(candidate, ctx = {}) {
    const rng = ctx.rng ?? defaultRng;
    for (const radiusKm of [8, 20]) {
      if (ctx.signal?.aborted || commonsThrottled()) return null;
      const keyword = pickOne(OPEN_KEYWORDS[candidate.archetype], rng);
      const pages = await commonsSearch(keyword, candidate, radiusKm, ctx.signal);
      const scored = pages
        .map(scoreCommonsPage)
        .filter((s): s is { scene: Scene; score: number } => !!s && !ctx.excludeIds?.has(s.scene.id))
        .filter((s) => haversineKm(s.scene, candidate) <= radiusKm * 1.5)
        .sort((a, b) => b.score - a.score);
      if (scored.length === 0) continue;
      const top = scored.filter((s) => s.score >= scored[0].score - 1).slice(0, 6);
      const ordered = [...top].sort(() => rng() - 0.5);
      for (const { scene } of ordered.slice(0, 2)) {
        if (await checkImageQuality(scene.imageUrl!)) return scene;
      }
    }
    return null;
  },
};

const METRO_POOL_PLACES = new Set(['Delhi', 'Mumbai', 'Kolkata', 'Chennai', 'Bengaluru', 'Hyderabad', 'Pune']);

export function poolForPack(pack: RegionPack, pool: readonly PoolImage[] = FALLBACK_POOL): PoolImage[] {
  if (pack === 'all') return [...pool];
  if (pack === 'metro') return pool.filter((p) => METRO_POOL_PLACES.has(p.place));
  return pool.filter((p) => INDIA_STATES[p.state].region === pack);
}

export function poolImageToScene(p: PoolImage): Scene {
  return {
    lat: p.lat,
    lng: p.lng,
    provider: 'open',
    kind: 'photo',
    id: p.title,
    imageUrl: p.url,
    heading: null,
    knownPlace: { name: p.place, state: p.state },
    attribution: { source: 'Wikimedia Commons', title: p.title, author: p.author, license: p.license, url: p.page },
  };
}

/** Verified local pool — the last line of defence so a round always loads. */
export function pickFromFallbackPool(
  pack: RegionPack,
  { previous = [], excludeIds, rng = defaultRng, minSeparationKm = 35 }: { previous?: readonly LatLng[]; excludeIds?: ReadonlySet<string>; rng?: Rng; minSeparationKm?: number } = {},
): Scene {
  const tiers = [poolForPack(pack), FALLBACK_POOL];
  for (const tier of tiers) {
    const fresh = tier.filter((p) => !excludeIds?.has(p.title));
    const separated = fresh.filter((p) => previous.every((q) => haversineKm(p, q) >= minSeparationKm));
    const choice = separated.length ? separated : fresh;
    if (choice.length) return poolImageToScene(pickOne(choice, rng));
  }
  return poolImageToScene(pickOne(FALLBACK_POOL, rng));
}

/* ------------------------------------------------------------------ */

const PROVIDERS: Record<ProviderId, ImageryProvider> = { google: googleProvider, mapillary: mapillaryProvider, open: openProvider };

export function getProvider(id: ProviderId): ImageryProvider {
  return PROVIDERS[id];
}

/** Resolve the best working provider, degrading gracefully (Google → Mapillary → Open). */
export async function resolveActiveProvider(): Promise<ImageryProvider> {
  if (GOOGLE_KEY && !googleAuthFailed()) {
    try {
      await loadGoogleMaps(GOOGLE_KEY);
      await streetViewLibrary();
      return googleProvider;
    } catch {
      // fall through
    }
  }
  if (MAPILLARY_TOKEN) return mapillaryProvider;
  return openProvider;
}
