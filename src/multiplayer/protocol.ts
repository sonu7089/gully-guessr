import type { Scene } from '../engine/imageryProviders';
import type { RevealedPlace } from '../engine/roundPlanner';
import type { Archetype, GameSettings, LatLng } from '../engine/types';

/** Shared by the browser and the game server, so it must stay free of DOM and Node imports. */

export type RoomKind = 'duel' | 'party';

export const MAX_PLAYERS: Record<RoomKind, number> = { duel: 2, party: 4 };
export const MP_ROUNDS = 5;
/** Round length when the room's timer is set to "no limit". */
export const DEFAULT_ROUND_SECONDS = 120;
/** Once someone guesses, everyone else has at most this long left. */
export const GUESS_GRACE_SECONDS = 15;
export const REVEAL_SECONDS = 12;
/** Allowance for a timed-out client's auto-submitted pin to arrive after the deadline. */
export const LATE_GUESS_MS = 2500;
export const CODE_LENGTH = 5;
export const WS_PATH = '/ws';

export type Phase = 'lobby' | 'preparing' | 'playing' | 'reveal' | 'finished';

export interface PlayerView {
  uid: string;
  name: string;
  photoURL: string | null;
  connected: boolean;
  /** Left mid-game; kept on the scoreboard. */
  left: boolean;
  total: number;
  /** Has guessed in the current round. */
  guessed: boolean;
  ready: boolean;
}

export interface GuessView {
  uid: string;
  guess: LatLng | null;
  distanceKm: number | null;
  points: number;
}

export interface RoundView {
  index: number;
  scene: Scene;
  place: RevealedPlace;
  archetype: Archetype | null;
  guesses: GuessView[];
}

export interface RoomView {
  code: string;
  kind: RoomKind;
  /** Created by random matchmaking rather than an invite. */
  quick: boolean;
  hostUid: string;
  maxPlayers: number;
  settings: GameSettings;
  roundSeconds: number;
  players: PlayerView[];
  phase: Phase;
  round: number;
  totalRounds: number;
  /** Scene for the round being played. */
  scene: Scene | null;
  myGuess: LatLng | null;
  /** Milliseconds until the round deadline (playing) or the next round (reveal). */
  endsInMs: number | null;
  /** True once someone has guessed and the short grace timer is running. */
  graceActive: boolean;
  results: RoundView[];
}

export interface ScenePayload {
  scene: Scene;
  place: RevealedPlace;
  archetype: Archetype | null;
}

export type ClientMessage =
  | { t: 'hello'; token: string; name: string; photoURL: string | null }
  | { t: 'queue.join' }
  | { t: 'queue.leave' }
  | { t: 'room.create'; kind: RoomKind; settings: GameSettings }
  | { t: 'room.join'; code: string }
  | { t: 'room.leave' }
  | { t: 'room.settings'; settings: GameSettings }
  | { t: 'room.kick'; uid: string }
  | { t: 'room.start' }
  | { t: 'room.rematch' }
  | { t: 'guess'; round: number; guess: LatLng }
  | { t: 'ready'; round: number }
  | ({ t: 'scene'; round: number } & ScenePayload)
  | { t: 'scene.failed'; round: number }
  | { t: 'ping' };

export type ErrorCode = 'auth' | 'not_found' | 'full' | 'started' | 'not_host' | 'bad_request' | 'replaced';

export type ServerMessage =
  | { t: 'welcome'; uid: string; name: string }
  | { t: 'state'; room: RoomView | null }
  | { t: 'queue'; searching: boolean; since: number | null }
  | { t: 'generate'; round: number; settings: GameSettings; previous: LatLng[]; excludeIds: string[] }
  | { t: 'error'; code: ErrorCode; message: string }
  | { t: 'pong' };

export const normalizeCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);

export const NAME_MIN = 2;
export const NAME_MAX = 20;

export function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
}
