import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scene } from '../src/engine/imageryProviders';
import type { GameSettings } from '../src/engine/types';
import { DEFAULT_ROUND_SECONDS, GUESS_GRACE_SECONDS, LATE_GUESS_MS, MP_ROUNDS, REVEAL_SECONDS, type ServerMessage } from '../src/multiplayer/protocol';
import { Lobby, QUICK_SETTINGS } from './lobby';

const SETTINGS: GameSettings = { scope: 'city', pack: 'all', state: 'MH', city: 'bengaluru', ruleset: 'standard', timer: 60 };

function harness() {
  const inbox = new Map<string, ServerMessage[]>();
  const lobby = new Lobby({
    send: (uid, msg) => inbox.set(uid, [...(inbox.get(uid) ?? []), msg]),
    sizeKmFor: (s) => (s.scope === 'city' ? 36 : 4450),
    random: () => 0.5,
    generateTimeoutMs: 30_000,
  });
  const last = <T extends ServerMessage['t']>(uid: string, t: T) =>
    [...(inbox.get(uid) ?? [])].reverse().find((m): m is Extract<ServerMessage, { t: T }> => m.t === t);
  const join = (...uids: string[]) => uids.forEach((u) => lobby.connect(u, `Player ${u}`, null));
  const scene = (i: number): Scene => ({ provider: 'google', kind: 'google', id: `pano-${i}`, lat: 12.97 + i * 0.01, lng: 77.59, heading: 0 });
  const place = { locality: 'Somewhere', district: null, stateCode: 'KA' as const, stateName: 'Karnataka', road: null };
  /** Answers the latest generate request sent to `uid`. */
  const supply = (uid: string) => {
    const req = last(uid, 'generate');
    if (!req) throw new Error(`${uid} was not asked to generate`);
    lobby.handle(uid, { t: 'scene', round: req.round, scene: scene(req.round), place, archetype: 'urban_town' });
    return req;
  };
  return { lobby, inbox, last, join, scene, supply };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('random matchmaking', () => {
  it('pairs any two waiting players into a duel and asks one of them for round 1', () => {
    const h = harness();
    h.join('a', 'b', 'c');
    h.lobby.handle('a', { t: 'queue.join' });
    expect(h.last('a', 'queue')?.searching).toBe(true);
    expect(h.lobby.roomOf('a')).toBeNull();

    h.lobby.handle('c', { t: 'queue.join' });
    const room = h.lobby.roomOf('a')!;
    expect(room).toMatchObject({ kind: 'duel', quick: true, phase: 'preparing', settings: QUICK_SETTINGS });
    expect(room.players.map((p) => p.uid)).toEqual(['a', 'c']);
    expect(h.lobby.roomOf('c')?.code).toBe(room.code);
    expect(h.last('c', 'queue')?.searching).toBe(false);
    expect(h.last('a', 'generate')).toMatchObject({ round: 0, previous: [] });
    expect(h.lobby.queueSize).toBe(0);
  });

  it('drops players who leave the queue or disconnect', () => {
    const h = harness();
    h.join('a', 'b');
    h.lobby.handle('a', { t: 'queue.join' });
    h.lobby.handle('a', { t: 'queue.leave' });
    h.lobby.handle('b', { t: 'queue.join' });
    expect(h.lobby.roomOf('b')).toBeNull();
    h.lobby.disconnect('b');
    expect(h.lobby.queueSize).toBe(0);
  });
});

describe('rooms', () => {
  it('lets up to four players join a party room by code', () => {
    const h = harness();
    h.join('a', 'b', 'c', 'd', 'e');
    h.lobby.handle('a', { t: 'room.create', kind: 'party', settings: SETTINGS });
    const code = h.lobby.roomOf('a')!.code;
    for (const u of ['b', 'c', 'd']) h.lobby.handle(u, { t: 'room.join', code: code.toLowerCase() });
    expect(h.lobby.roomOf('a')!.players).toHaveLength(4);

    h.lobby.handle('e', { t: 'room.join', code });
    expect(h.last('e', 'error')?.code).toBe('full');
    h.lobby.handle('e', { t: 'room.join', code: 'ZZZZZ' });
    expect(h.last('e', 'error')?.code).toBe('not_found');
  });

  it('caps a 1v1 room at two players', () => {
    const h = harness();
    h.join('a', 'b', 'c');
    h.lobby.handle('a', { t: 'room.create', kind: 'duel', settings: SETTINGS });
    const code = h.lobby.roomOf('a')!.code;
    h.lobby.handle('b', { t: 'room.join', code });
    h.lobby.handle('c', { t: 'room.join', code });
    expect(h.last('c', 'error')?.code).toBe('full');
  });

  it('only lets the host change settings and start, and needs two players', () => {
    const h = harness();
    h.join('a', 'b');
    h.lobby.handle('a', { t: 'room.create', kind: 'party', settings: SETTINGS });
    h.lobby.handle('a', { t: 'room.start' });
    expect(h.last('a', 'error')?.message).toMatch(/two players/);

    const code = h.lobby.roomOf('a')!.code;
    h.lobby.handle('b', { t: 'room.join', code });
    h.lobby.handle('b', { t: 'room.settings', settings: { ...SETTINGS, city: 'mumbai' } });
    expect(h.last('b', 'error')?.code).toBe('not_host');
    h.lobby.handle('a', { t: 'room.settings', settings: { ...SETTINGS, city: 'mumbai', timer: 999 as never } });
    expect(h.lobby.roomOf('b')!.settings).toMatchObject({ city: 'mumbai', timer: 0 });
    expect(h.lobby.roomOf('b')!.roundSeconds).toBe(DEFAULT_ROUND_SECONDS);

    h.lobby.handle('a', { t: 'room.start' });
    expect(h.lobby.roomOf('b')!.phase).toBe('preparing');
    h.lobby.handle('c' as string, { t: 'room.join', code });
  });

  it('refuses to seat newcomers once the game has started', () => {
    const h = harness();
    h.join('a', 'b', 'c');
    h.lobby.handle('a', { t: 'room.create', kind: 'party', settings: SETTINGS });
    const code = h.lobby.roomOf('a')!.code;
    h.lobby.handle('b', { t: 'room.join', code });
    h.lobby.handle('a', { t: 'room.start' });
    h.lobby.handle('c', { t: 'room.join', code });
    expect(h.last('c', 'error')?.code).toBe('started');
  });

  it('passes host to the next player and closes empty rooms', () => {
    const h = harness();
    h.join('a', 'b');
    h.lobby.handle('a', { t: 'room.create', kind: 'party', settings: SETTINGS });
    h.lobby.handle('b', { t: 'room.join', code: h.lobby.roomOf('a')!.code });
    h.lobby.handle('a', { t: 'room.leave' });
    expect(h.lobby.roomOf('b')!.hostUid).toBe('b');
    h.lobby.handle('b', { t: 'room.leave' });
    expect(h.lobby.roomCount).toBe(0);
  });
});

describe('match flow', () => {
  function startedDuel() {
    const h = harness();
    h.join('a', 'b');
    h.lobby.handle('a', { t: 'room.create', kind: 'duel', settings: SETTINGS });
    h.lobby.handle('b', { t: 'room.join', code: h.lobby.roomOf('a')!.code });
    h.lobby.handle('a', { t: 'room.start' });
    return h;
  }

  it('plays a round: scene, grace timer after the first guess, scored reveal', () => {
    const h = startedDuel();
    h.supply('a');
    let view = h.lobby.roomOf('b')!;
    expect(view.phase).toBe('playing');
    expect(view.scene?.id).toBe('pano-0');
    expect(view.endsInMs).toBe(60_000);
    expect(h.last('a', 'generate')?.round).toBe(1);

    h.lobby.handle('a', { t: 'guess', round: 0, guess: { lat: 12.97, lng: 77.59 } });
    view = h.lobby.roomOf('b')!;
    expect(view.graceActive).toBe(true);
    expect(view.endsInMs).toBe(GUESS_GRACE_SECONDS * 1000);
    expect(view.players.find((p) => p.uid === 'a')?.guessed).toBe(true);
    expect(view.myGuess).toBeNull();

    h.lobby.handle('b', { t: 'guess', round: 0, guess: { lat: 13.1, lng: 77.59 } });
    view = h.lobby.roomOf('a')!;
    expect(view.phase).toBe('reveal');
    const [ga, gb] = view.results[0].guesses;
    expect(ga.points).toBe(5000);
    expect(gb.points).toBeLessThan(5000);
    expect(view.players.find((p) => p.uid === 'b')?.total).toBe(gb.points);
  });

  it('scores silent players zero when the clock runs out', () => {
    const h = startedDuel();
    h.supply('a');
    h.lobby.handle('a', { t: 'guess', round: 0, guess: { lat: 12.97, lng: 77.59 } });
    vi.advanceTimersByTime(GUESS_GRACE_SECONDS * 1000 + LATE_GUESS_MS);
    const view = h.lobby.roomOf('a')!;
    expect(view.phase).toBe('reveal');
    expect(view.results[0].guesses.find((g) => g.uid === 'b')).toMatchObject({ guess: null, points: 0 });
  });

  it('ignores duplicate, wrong-round and malformed guesses', () => {
    const h = startedDuel();
    h.supply('a');
    h.lobby.handle('a', { t: 'guess', round: 3, guess: { lat: 12.97, lng: 77.59 } });
    h.lobby.handle('a', { t: 'guess', round: 0, guess: { lat: Number.NaN, lng: 1 } as never });
    expect(h.lobby.roomOf('a')!.players.every((p) => !p.guessed)).toBe(true);
    h.lobby.handle('a', { t: 'guess', round: 0, guess: { lat: 13.5, lng: 77.59 } });
    h.lobby.handle('a', { t: 'guess', round: 0, guess: { lat: 12.97, lng: 77.59 } });
    expect(h.lobby.roomOf('a')!.myGuess).toEqual({ lat: 13.5, lng: 77.59 });
  });

  it('runs five rounds to a finished scoreboard', () => {
    const h = startedDuel();
    for (let r = 0; r < MP_ROUNDS; r++) {
      if (r === 0) h.supply('a');
      expect(h.lobby.roomOf('a')!.phase).toBe('playing');
      if (r + 1 < MP_ROUNDS) h.supply('a');
      h.lobby.handle('a', { t: 'guess', round: r, guess: h.scene(r) });
      h.lobby.handle('b', { t: 'guess', round: r, guess: { lat: h.scene(r).lat + 0.05, lng: 77.59 } });
      if (r % 2) {
        h.lobby.handle('a', { t: 'ready', round: r });
        h.lobby.handle('b', { t: 'ready', round: r });
      } else {
        vi.advanceTimersByTime(REVEAL_SECONDS * 1000);
      }
    }
    const view = h.lobby.roomOf('b')!;
    expect(view.phase).toBe('finished');
    expect(view.results).toHaveLength(MP_ROUNDS);
    expect(view.players.find((p) => p.uid === 'a')!.total).toBe(MP_ROUNDS * 5000);
  });

  it('hands round generation to another player when the generator drops', () => {
    const h = startedDuel();
    h.lobby.disconnect('a');
    expect(h.last('b', 'generate')?.round).toBe(0);
    h.supply('b');
    expect(h.lobby.roomOf('b')!.phase).toBe('playing');
  });

  it('asks someone else if the generator stalls', () => {
    const h = startedDuel();
    vi.advanceTimersByTime(30_000);
    expect(h.last('b', 'generate')?.round).toBe(0);
  });

  it('ends a duel by walkover when the opponent leaves', () => {
    const h = startedDuel();
    h.supply('a');
    h.lobby.handle('b', { t: 'room.leave' });
    const view = h.lobby.roomOf('a')!;
    expect(view.phase).toBe('finished');
    expect(view.players.find((p) => p.uid === 'b')?.left).toBe(true);
  });

  it('keeps a disconnected player in the match and lets them rejoin', () => {
    const h = startedDuel();
    h.supply('a');
    h.lobby.disconnect('b');
    h.lobby.handle('a', { t: 'guess', round: 0, guess: h.scene(0) });
    expect(h.lobby.roomOf('a')!.phase).toBe('reveal');
    h.lobby.connect('b', 'Player b', null);
    expect(h.last('b', 'state')?.room?.phase).toBe('reveal');
  });

  it('lets the host bring everyone back to the lobby for a rematch', () => {
    const h = startedDuel();
    h.supply('a');
    h.lobby.handle('b', { t: 'room.leave' });
    h.lobby.handle('a', { t: 'room.rematch' });
    const view = h.lobby.roomOf('a')!;
    expect(view.phase).toBe('lobby');
    expect(view.players.map((p) => p.uid)).toEqual(['a']);
    expect(view.results).toHaveLength(0);
  });
});
