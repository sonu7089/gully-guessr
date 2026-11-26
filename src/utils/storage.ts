import { CITY_BY_ID } from '../data/indiaCities';
import { PLAYABLE_STATES } from '../engine/playArea';
import type { GameScope, GameSettings, RegionPack, Ruleset, StateCode, TimerOption } from '../engine/types';

const KEYS = {
  stats: 'gullyguessr:stats:v1',
  matches: 'gullyguessr:matches:v1',
  settings: 'gullyguessr:settings:v1',
  recentAnchors: 'gullyguessr:recent-anchors:v1',
  recentScenes: 'gullyguessr:recent-scenes:v1',
} as const;

export interface RoundRecord {
  index: number;
  actual: { lat: number; lng: number };
  guess: { lat: number; lng: number } | null;
  distanceKm: number | null;
  points: number;
  timeTakenSec: number;
  locality: string;
  stateCode: StateCode | null;
  stateName: string;
  archetype: string;
  correctState: boolean;
}

export interface MatchRecord {
  id: string;
  playedAt: string;
  total: number;
  settings: GameSettings;
  rounds: RoundRecord[];
}

export interface LocalStats {
  bestScore: number;
  gamesCompleted: number;
  totalDistanceKm: number;
  guessedRounds: number;
  bestRound: { points: number; distanceKm: number | null; locality: string; stateName: string } | null;
}

export const EMPTY_STATS: LocalStats = { bestScore: 0, gamesCompleted: 0, totalDistanceKm: 0, guessedRounds: 0, bestRound: null };
export const DEFAULT_SETTINGS: GameSettings = { scope: 'india', pack: 'all', state: 'KA', city: 'bengaluru', ruleset: 'standard', timer: 0 };

const MAX_MATCHES = 20;
const MAX_RECENT_ANCHORS = 40;
const MAX_RECENT_SCENES = 120;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function readArray<T>(key: string): T[] {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or disabled — the game still works without persistence.
  }
}

export function loadStats(): LocalStats {
  return read(KEYS.stats, EMPTY_STATS);
}

export function averageDistanceKm(stats: LocalStats): number | null {
  return stats.guessedRounds > 0 ? stats.totalDistanceKm / stats.guessedRounds : null;
}

export function loadMatches(): MatchRecord[] {
  return readArray<MatchRecord>(KEYS.matches);
}

/** Persist a completed match; returns updated stats and whether it set a new personal best. */
export function recordMatch(match: MatchRecord): { stats: LocalStats; isNewBest: boolean } {
  const prev = loadStats();
  const isNewBest = match.total > prev.bestScore;
  let bestRound = prev.bestRound;
  for (const r of match.rounds) {
    if (!bestRound || r.points > bestRound.points) {
      bestRound = { points: r.points, distanceKm: r.distanceKm, locality: r.locality, stateName: r.stateName };
    }
  }
  const guessed = match.rounds.filter((r) => r.distanceKm != null);
  const stats: LocalStats = {
    bestScore: Math.max(prev.bestScore, match.total),
    gamesCompleted: prev.gamesCompleted + 1,
    totalDistanceKm: prev.totalDistanceKm + guessed.reduce((s, r) => s + (r.distanceKm ?? 0), 0),
    guessedRounds: prev.guessedRounds + guessed.length,
    bestRound,
  };
  write(KEYS.stats, stats);
  write(KEYS.matches, [match, ...loadMatches()].slice(0, MAX_MATCHES));
  return { stats, isNewBest };
}

export function resetStats(): void {
  try {
    globalThis.localStorage?.removeItem(KEYS.stats);
    globalThis.localStorage?.removeItem(KEYS.matches);
  } catch {
    // ignore
  }
}

const SCOPES: GameScope[] = ['india', 'state', 'city'];
const PACKS: RegionPack[] = ['all', 'north', 'south', 'west', 'east', 'metro'];
const RULESETS: Ruleset[] = ['standard', 'nomove', 'nmpz'];
const TIMERS: TimerOption[] = [0, 60, 90, 120];

export function loadSettings(): GameSettings {
  return sanitizeSettings(read(KEYS.settings, DEFAULT_SETTINGS));
}

/** Coerces untrusted settings (old saves, network messages) into a valid game. */
export function sanitizeSettings(raw: unknown): GameSettings {
  const s = (raw && typeof raw === 'object' ? raw : {}) as GameSettings;
  return {
    scope: SCOPES.includes(s.scope) ? s.scope : DEFAULT_SETTINGS.scope,
    pack: PACKS.includes(s.pack) ? s.pack : DEFAULT_SETTINGS.pack,
    state: PLAYABLE_STATES.includes(s.state) ? s.state : DEFAULT_SETTINGS.state,
    city: s.city in CITY_BY_ID ? s.city : DEFAULT_SETTINGS.city,
    ruleset: RULESETS.includes(s.ruleset) ? s.ruleset : DEFAULT_SETTINGS.ruleset,
    timer: TIMERS.includes(s.timer) ? s.timer : DEFAULT_SETTINGS.timer,
  };
}

export function saveSettings(settings: GameSettings): void {
  write(KEYS.settings, settings);
}

function pushRecent(key: string, ids: string[], max: number): void {
  const merged = [...ids, ...readArray<string>(key).filter((id) => !ids.includes(id))];
  write(key, merged.slice(0, max));
}

export const loadRecentAnchors = () => readArray<string>(KEYS.recentAnchors);
export const pushRecentAnchors = (ids: string[]) => pushRecent(KEYS.recentAnchors, ids, MAX_RECENT_ANCHORS);
export const loadRecentScenes = () => readArray<string>(KEYS.recentScenes);
export const pushRecentScenes = (ids: string[]) => pushRecent(KEYS.recentScenes, ids, MAX_RECENT_SCENES);
