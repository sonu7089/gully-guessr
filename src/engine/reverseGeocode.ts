import { INDIA_STATES, resolveStateCode } from '../data/indiaStateClues';
import { geocodingLibrary } from './googleMaps';
import type { LatLng, StateCode } from './types';

export interface PlaceInfo {
  locality: string | null;
  district: string | null;
  stateCode: StateCode | null;
  stateName: string | null;
  road: string | null;
  countryCode: string | null;
  source: 'google' | 'nominatim' | 'anchor';
}

const NOMINATIM_INTERVAL_MS = 1100;
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const cache = new Map<string, Promise<PlaceInfo | null>>();

/** Serialise Nominatim calls to respect its 1 request/second usage policy. */
function politely<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + NOMINATIM_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

interface NominatimResponse {
  address?: Record<string, string>;
  error?: string;
}

export function parseNominatim(json: NominatimResponse): PlaceInfo | null {
  const a = json.address;
  if (!a) return null;
  const stateRaw = a['ISO3166-2-lvl4'] ?? a.state ?? a.territory ?? a.union_territory;
  const stateCode = resolveStateCode(stateRaw) ?? resolveStateCode(a.state);
  const locality = a.city ?? a.town ?? a.village ?? a.suburb ?? a.hamlet ?? a.municipality ?? a.city_district ?? a.county ?? a.state_district ?? null;
  return {
    locality,
    district: a.state_district ?? a.county ?? null,
    stateCode,
    stateName: stateCode ? INDIA_STATES[stateCode].name : a.state ?? null,
    road: a.road ?? null,
    countryCode: a.country_code ?? null,
    source: 'nominatim',
  };
}

async function nominatim(p: LatLng, zoom: number, signal?: AbortSignal): Promise<PlaceInfo | null> {
  return politely(async () => {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: p.lat.toFixed(6),
      lon: p.lng.toFixed(6),
      zoom: String(zoom),
      addressdetails: '1',
      'accept-language': 'en',
    });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    signal?.addEventListener('abort', () => ctrl.abort());
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { signal: ctrl.signal });
      if (!res.ok) return null;
      return parseNominatim((await res.json()) as NominatimResponse);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}

async function googleGeocode(p: LatLng): Promise<PlaceInfo | null> {
  try {
    const { Geocoder } = await geocodingLibrary();
    const { results } = await new Geocoder().geocode({ location: p, language: 'en' });
    const comps = results[0]?.address_components ?? [];
    const find = (type: string) => comps.find((c) => c.types.includes(type));
    const admin1 = find('administrative_area_level_1');
    const stateCode = resolveStateCode(admin1?.long_name) ?? resolveStateCode(admin1?.short_name);
    return {
      locality: (find('locality') ?? find('sublocality') ?? find('administrative_area_level_3'))?.long_name ?? null,
      district: find('administrative_area_level_3')?.long_name ?? find('administrative_area_level_2')?.long_name ?? null,
      stateCode,
      stateName: stateCode ? INDIA_STATES[stateCode].name : admin1?.long_name ?? null,
      road: find('route')?.long_name ?? null,
      countryCode: find('country')?.short_name?.toLowerCase() ?? null,
      source: 'google',
    };
  } catch {
    return null;
  }
}

export interface ReverseGeocodeOptions {
  useGoogle?: boolean;
  zoom?: number;
  signal?: AbortSignal;
}

/** Reverse geocode via Google (when active) or Nominatim. Results are cached. */
export function reverseGeocode(p: LatLng, { useGoogle = false, zoom = 14, signal }: ReverseGeocodeOptions = {}): Promise<PlaceInfo | null> {
  const key = `${p.lat.toFixed(4)},${p.lng.toFixed(4)},${zoom},${useGoogle}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => (useGoogle ? (await googleGeocode(p)) ?? (await nominatim(p, zoom, signal)) : nominatim(p, zoom, signal)))();
    cache.set(key, hit);
    hit.then((v) => v === null && cache.delete(key));
  }
  return hit;
}
