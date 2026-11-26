import type { GameSettings, LatLng } from '../src/engine/types';
import {
  cleanName,
  CODE_LENGTH,
  DEFAULT_ROUND_SECONDS,
  GUESS_GRACE_SECONDS,
  LATE_GUESS_MS,
  MAX_PLAYERS,
  MP_ROUNDS,
  normalizeCode,
  REVEAL_SECONDS,
  type ClientMessage,
  type ErrorCode,
  type GuessView,
  type Phase,
  type RoomKind,
  type RoomView,
  type RoundView,
  type ScenePayload,
  type ServerMessage,
} from '../src/multiplayer/protocol';
import { haversineKm, scoreForDistance } from '../src/utils/scoring';
import { sanitizeSettings } from '../src/utils/storage';

export interface LobbyDeps {
  send(uid: string, msg: ServerMessage): void;
  /** Play-area diagonal for a settings object; drives the score curve. */
  sizeKmFor(settings: GameSettings): number;
  random?: () => number;
  /** How long a disconnected player keeps their lobby seat. */
  lobbySeatMs?: number;
  /** How long the round generator may take before another player is asked. */
  generateTimeoutMs?: number;
}

export const QUICK_SETTINGS: GameSettings = { scope: 'india', pack: 'all', state: 'MH', city: 'delhi', ruleset: 'standard', timer: 120 };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface User {
  uid: string;
  name: string;
  photoURL: string | null;
  connected: boolean;
  room: Room | null;
  queuedAt: number | null;
  seatTimer: ReturnType<typeof setTimeout> | null;
}

interface Member {
  uid: string;
  left: boolean;
  total: number;
  ready: boolean;
}

interface Guess {
  guess: LatLng | null;
  distanceKm: number | null;
  points: number;
}

interface Room {
  code: string;
  kind: RoomKind;
  quick: boolean;
  hostUid: string;
  settings: GameSettings;
  sizeKm: number;
  members: Map<string, Member>;
  phase: Phase;
  round: number;
  scenes: (ScenePayload | undefined)[];
  requested: number;
  generatorUid: string | null;
  generateTimer: ReturnType<typeof setTimeout> | null;
  guesses: Map<string, Guess>;
  results: RoundView[];
  deadline: number | null;
  graceActive: boolean;
  phaseTimer: ReturnType<typeof setTimeout> | null;
}

const isLatLng = (p: unknown): p is LatLng =>
  !!p && typeof p === 'object' && Number.isFinite((p as LatLng).lat) && Number.isFinite((p as LatLng).lng) && Math.abs((p as LatLng).lat) <= 90 && Math.abs((p as LatLng).lng) <= 180;

const roundSecondsFor = (s: GameSettings) => s.timer || DEFAULT_ROUND_SECONDS;

/**
 * All matchmaking, room and round state. Transport-agnostic: the socket layer feeds it
 * connect / disconnect / message events and delivers whatever it passes to `send`.
 */
export class Lobby {
  private readonly users = new Map<string, User>();
  private readonly rooms = new Map<string, Room>();
  private queue: string[] = [];
  private readonly random: () => number;
  private readonly lobbySeatMs: number;
  private readonly generateTimeoutMs: number;

  constructor(private readonly deps: LobbyDeps) {
    this.random = deps.random ?? Math.random;
    this.lobbySeatMs = deps.lobbySeatMs ?? 45_000;
    this.generateTimeoutMs = deps.generateTimeoutMs ?? 75_000;
  }

  /* ---------------------------------------------------------------- connections */

  connect(uid: string, name: string, photoURL: string | null): void {
    const user = this.users.get(uid) ?? { uid, name, photoURL, connected: true, room: null, queuedAt: null, seatTimer: null };
    user.name = cleanName(name) || user.name || 'Player';
    user.photoURL = typeof photoURL === 'string' && /^https:\/\//.test(photoURL) ? photoURL.slice(0, 500) : null;
    user.connected = true;
    if (user.seatTimer) clearTimeout(user.seatTimer);
    user.seatTimer = null;
    this.users.set(uid, user);
    this.deps.send(uid, { t: 'welcome', uid, name: user.name });
    this.deps.send(uid, { t: 'queue', searching: user.queuedAt != null, since: user.queuedAt });
    const room = user.room;
    if (room) {
      const pending = this.inMatch(room) && room.requested >= 0 && room.requested < MP_ROUNDS && !room.scenes[room.requested];
      const generator = room.generatorUid ? this.users.get(room.generatorUid) : null;
      if (pending && (room.generatorUid === uid || !generator?.connected)) {
        // A returning player resumes (or takes over) the round that was being prepared.
        room.generatorUid = uid;
        this.requestScene(room, room.requested);
      }
      this.broadcast(room);
    } else {
      this.deps.send(uid, { t: 'state', room: null });
    }
  }

  disconnect(uid: string): void {
    const user = this.users.get(uid);
    if (!user) return;
    user.connected = false;
    this.dequeue(user);
    const room = user.room;
    if (!room) {
      this.users.delete(uid);
      return;
    }
    if (!this.inMatch(room)) {
      user.seatTimer = setTimeout(() => this.leaveRoom(user), this.lobbySeatMs);
      this.broadcast(room);
      return;
    }
    if (room.generatorUid === uid) this.reassignGenerator(room);
    if (!this.activeUids(room).some((id) => this.users.get(id)?.connected)) {
      // Nobody left to play; give them the seat timeout to come back.
      user.seatTimer = setTimeout(() => this.closeIfAbandoned(room), this.lobbySeatMs);
    }
    this.checkRoundComplete(room);
    this.broadcast(room);
  }

  handle(uid: string, msg: ClientMessage): void {
    const user = this.users.get(uid);
    if (!user || !msg || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'queue.join':
        return this.enqueue(user);
      case 'queue.leave':
        this.dequeue(user);
        return this.deps.send(uid, { t: 'queue', searching: false, since: null });
      case 'room.create':
        return this.createRoom(user, msg.kind === 'duel' ? 'duel' : 'party', sanitizeSettings(msg.settings));
      case 'room.join':
        return this.joinRoom(user, typeof msg.code === 'string' ? normalizeCode(msg.code) : '');
      case 'room.leave':
        return this.leaveRoom(user);
      case 'room.settings':
        return this.updateSettings(user, sanitizeSettings(msg.settings));
      case 'room.kick':
        return this.kick(user, msg.uid);
      case 'room.start':
        return this.startFromLobby(user);
      case 'room.rematch':
        return this.rematch(user);
      case 'guess':
        return this.guess(user, msg.round, msg.guess);
      case 'ready':
        return this.ready(user, msg.round);
      case 'scene':
        return this.receiveScene(user, msg.round, { scene: msg.scene, place: msg.place, archetype: msg.archetype ?? null });
      case 'scene.failed':
        return this.sceneFailed(user, msg.round);
      case 'ping':
        return this.deps.send(uid, { t: 'pong' });
    }
  }

  /* ---------------------------------------------------------------- queries (tests, metrics) */

  roomOf(uid: string): RoomView | null {
    const room = this.users.get(uid)?.room;
    return room ? this.view(room, uid) : null;
  }

  get queueSize(): number {
    return this.queue.length;
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  /* ---------------------------------------------------------------- matchmaking */

  private enqueue(user: User): void {
    if (user.room) this.leaveRoom(user);
    if (user.queuedAt == null) {
      user.queuedAt = Date.now();
      this.queue.push(user.uid);
    }
    this.deps.send(user.uid, { t: 'queue', searching: true, since: user.queuedAt });
    this.matchQueue();
  }

  private dequeue(user: User): void {
    if (user.queuedAt == null) return;
    user.queuedAt = null;
    this.queue = this.queue.filter((id) => id !== user.uid);
  }

  /** First come, first matched: any two waiting players make a duel. */
  private matchQueue(): void {
    this.queue = this.queue.filter((id) => this.users.get(id)?.connected);
    while (this.queue.length >= 2) {
      const pair = this.queue.splice(0, 2).map((id) => this.users.get(id)!);
      for (const u of pair) {
        u.queuedAt = null;
        this.deps.send(u.uid, { t: 'queue', searching: false, since: null });
      }
      const room = this.newRoom(pair[0], 'duel', QUICK_SETTINGS, true);
      this.addMember(room, pair[1]);
      this.startMatch(room);
    }
  }

  /* ---------------------------------------------------------------- rooms */

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  private newRoom(host: User, kind: RoomKind, settings: GameSettings, quick: boolean): Room {
    const room: Room = {
      code: this.newCode(),
      kind,
      quick,
      hostUid: host.uid,
      settings,
      sizeKm: this.deps.sizeKmFor(settings),
      members: new Map(),
      phase: 'lobby',
      round: 0,
      scenes: [],
      requested: -1,
      generatorUid: null,
      generateTimer: null,
      guesses: new Map(),
      results: [],
      deadline: null,
      graceActive: false,
      phaseTimer: null,
    };
    this.rooms.set(room.code, room);
    this.addMember(room, host);
    return room;
  }

  private addMember(room: Room, user: User): void {
    this.dequeue(user);
    room.members.set(user.uid, { uid: user.uid, left: false, total: 0, ready: false });
    user.room = room;
  }

  private createRoom(user: User, kind: RoomKind, settings: GameSettings): void {
    if (user.room) this.leaveRoom(user);
    const room = this.newRoom(user, kind, settings, false);
    this.broadcast(room);
  }

  private joinRoom(user: User, code: string): void {
    const room = this.rooms.get(code);
    if (!room) return this.fail(user, 'not_found', `No room with code ${code || '—'}. Check the code and try again.`);
    const existing = room.members.get(user.uid);
    if (existing && !existing.left) {
      if (user.seatTimer) clearTimeout(user.seatTimer);
      user.seatTimer = null;
      return this.broadcast(room);
    }
    if (room.phase !== 'lobby') return this.fail(user, 'started', 'That game has already started.');
    if (this.activeUids(room).length >= MAX_PLAYERS[room.kind]) return this.fail(user, 'full', 'That room is full.');
    if (user.room && user.room !== room) this.leaveRoom(user);
    this.addMember(room, user);
    this.broadcast(room);
  }

  private leaveRoom(user: User): void {
    const room = user.room;
    if (user.seatTimer) clearTimeout(user.seatTimer);
    user.seatTimer = null;
    if (!room) return;
    user.room = null;
    const inGame = this.inMatch(room);
    if (inGame || room.phase === 'finished') {
      const m = room.members.get(user.uid);
      if (m) m.left = true;
    } else {
      room.members.delete(user.uid);
    }
    if (user.connected) this.deps.send(user.uid, { t: 'state', room: null });
    else this.users.delete(user.uid);

    const active = this.activeUids(room);
    if (active.length === 0) return this.closeRoom(room);
    if (room.hostUid === user.uid) room.hostUid = active.find((id) => this.users.get(id)?.connected) ?? active[0];
    if (inGame) {
      if (room.generatorUid === user.uid) this.reassignGenerator(room);
      // A match needs an opponent; the last one standing wins by walkover.
      if (active.length < 2) return this.finish(room);
      this.checkRoundComplete(room);
    }
    this.broadcast(room);
  }

  private kick(host: User, uid: unknown): void {
    const room = host.room;
    if (!room || room.hostUid !== host.uid || room.phase !== 'lobby' || uid === host.uid || typeof uid !== 'string') return;
    const target = this.users.get(uid);
    if (target?.room === room) {
      this.leaveRoom(target);
      if (target.connected) this.fail(target, 'not_found', 'The host removed you from the room.');
    }
  }

  private updateSettings(user: User, settings: GameSettings): void {
    const room = user.room;
    if (!room || room.quick || room.phase !== 'lobby') return;
    if (room.hostUid !== user.uid) return this.fail(user, 'not_host', 'Only the host can change the map.');
    room.settings = settings;
    room.sizeKm = this.deps.sizeKmFor(settings);
    this.broadcast(room);
  }

  private startFromLobby(user: User): void {
    const room = user.room;
    if (!room || room.phase !== 'lobby') return;
    if (room.hostUid !== user.uid) return this.fail(user, 'not_host', 'Only the host can start the game.');
    const ready = this.activeUids(room).filter((id) => this.users.get(id)?.connected);
    if (ready.length < 2) return this.fail(user, 'bad_request', 'You need at least two players to start.');
    for (const id of this.activeUids(room)) if (!this.users.get(id)?.connected) this.leaveRoom(this.users.get(id)!);
    this.startMatch(room);
  }

  private rematch(user: User): void {
    const room = user.room;
    if (!room || room.phase !== 'finished' || room.quick) return;
    if (room.hostUid !== user.uid) return this.fail(user, 'not_host', 'Only the host can start a rematch.');
    for (const [id, m] of room.members) if (m.left) room.members.delete(id);
    this.resetMatch(room);
    room.phase = 'lobby';
    this.broadcast(room);
  }

  private closeIfAbandoned(room: Room): void {
    if (!this.activeUids(room).some((id) => this.users.get(id)?.connected)) this.closeRoom(room);
  }

  private closeRoom(room: Room): void {
    this.clearTimers(room);
    this.rooms.delete(room.code);
    for (const id of room.members.keys()) {
      const u = this.users.get(id);
      if (u?.room === room) {
        u.room = null;
        if (u.connected) this.deps.send(id, { t: 'state', room: null });
        else this.users.delete(id);
      }
    }
  }

  /* ---------------------------------------------------------------- match flow */

  private resetMatch(room: Room): void {
    this.clearTimers(room);
    room.round = 0;
    room.scenes = [];
    room.requested = -1;
    room.generatorUid = null;
    room.guesses = new Map();
    room.results = [];
    room.deadline = null;
    room.graceActive = false;
    for (const m of room.members.values()) {
      m.total = 0;
      m.ready = false;
    }
  }

  private startMatch(room: Room): void {
    this.resetMatch(room);
    room.phase = 'preparing';
    room.generatorUid = this.users.get(room.hostUid)?.connected ? room.hostUid : (this.connectedUids(room)[0] ?? null);
    this.requestScene(room, 0);
    this.broadcast(room);
  }

  private requestScene(room: Room, index: number): void {
    if (index >= MP_ROUNDS || room.scenes[index]) return;
    room.requested = index;
    if (room.generateTimer) clearTimeout(room.generateTimer);
    room.generateTimer = setTimeout(() => {
      room.generateTimer = null;
      this.reassignGenerator(room, true);
    }, this.generateTimeoutMs);
    if (!room.generatorUid) return;
    const previous = room.scenes.slice(0, index).flatMap((s) => (s ? [{ lat: s.scene.lat, lng: s.scene.lng }] : []));
    const excludeIds = room.scenes.flatMap((s) => (s ? [s.scene.id] : []));
    this.deps.send(room.generatorUid, { t: 'generate', round: index, settings: room.settings, previous, excludeIds });
  }

  /** Hands round generation to another connected player (or retries the same one if alone). */
  private reassignGenerator(room: Room, timedOut = false): void {
    const candidates = this.connectedUids(room);
    if (candidates.length === 0) {
      room.generatorUid = null;
      return;
    }
    const others = candidates.filter((id) => id !== room.generatorUid);
    room.generatorUid = (timedOut || !candidates.includes(room.generatorUid ?? '')) && others.length ? others[Math.floor(this.random() * others.length)] : candidates[0];
    if (room.requested >= 0 && !room.scenes[room.requested]) this.requestScene(room, room.requested);
  }

  private receiveScene(user: User, index: number, payload: ScenePayload): void {
    const room = user.room;
    if (!room || room.generatorUid !== user.uid || index !== room.requested || room.scenes[index]) return;
    if (!isLatLng(payload.scene) || typeof payload.scene.id !== 'string' || !payload.place || typeof payload.place.locality !== 'string') return;
    if (room.generateTimer) clearTimeout(room.generateTimer);
    room.generateTimer = null;
    room.scenes[index] = payload;
    if (room.phase === 'preparing' && room.round === index) this.beginRound(room);
    this.requestScene(room, index + 1);
  }

  private sceneFailed(user: User, index: number): void {
    const room = user.room;
    if (!room || room.generatorUid !== user.uid || index !== room.requested) return;
    this.reassignGenerator(room, true);
  }

  private beginRound(room: Room): void {
    room.phase = 'playing';
    room.guesses = new Map();
    room.graceActive = false;
    for (const m of room.members.values()) m.ready = false;
    this.setDeadline(room, Date.now() + roundSecondsFor(room.settings) * 1000);
    this.broadcast(room);
  }

  private setDeadline(room: Room, at: number): void {
    room.deadline = at;
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    room.phaseTimer = setTimeout(() => this.endRound(room), Math.max(0, at - Date.now()) + LATE_GUESS_MS);
  }

  private guess(user: User, index: number, p: unknown): void {
    const room = user.room;
    const member = room?.members.get(user.uid);
    if (!room || !member || member.left || room.phase !== 'playing' || index !== room.round || room.guesses.has(user.uid) || !isLatLng(p)) return;
    if (room.deadline != null && Date.now() > room.deadline + LATE_GUESS_MS) return;
    const actual = room.scenes[room.round]!.scene;
    const distanceKm = haversineKm(p, actual);
    room.guesses.set(user.uid, { guess: { lat: p.lat, lng: p.lng }, distanceKm, points: scoreForDistance(distanceKm, room.sizeKm) });
    const graceAt = Date.now() + GUESS_GRACE_SECONDS * 1000;
    if (!room.graceActive && room.deadline != null && graceAt < room.deadline) {
      room.graceActive = true;
      this.setDeadline(room, graceAt);
    }
    if (!this.checkRoundComplete(room)) this.broadcast(room);
  }

  /** Ends the round early once every connected player has guessed. */
  private checkRoundComplete(room: Room): boolean {
    if (room.phase !== 'playing') return false;
    const waiting = this.activeUids(room).filter((id) => this.users.get(id)?.connected && !room.guesses.has(id));
    if (waiting.length > 0) return false;
    this.endRound(room);
    return true;
  }

  private endRound(room: Room): void {
    if (room.phase !== 'playing') return;
    const payload = room.scenes[room.round]!;
    const guesses: GuessView[] = [...room.members.values()]
      .filter((m) => !m.left || room.guesses.has(m.uid))
      .map((m) => {
        const g = room.guesses.get(m.uid) ?? { guess: null, distanceKm: null, points: 0 };
        m.total += g.points;
        return { uid: m.uid, ...g };
      });
    room.results.push({ index: room.round, scene: payload.scene, place: payload.place, archetype: payload.archetype, guesses });
    room.phase = 'reveal';
    room.graceActive = false;
    for (const m of room.members.values()) m.ready = false;
    room.deadline = Date.now() + REVEAL_SECONDS * 1000;
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    room.phaseTimer = setTimeout(() => this.advance(room), REVEAL_SECONDS * 1000);
    this.broadcast(room);
  }

  private ready(user: User, index: number): void {
    const room = user.room;
    const member = room?.members.get(user.uid);
    if (!room || !member || room.phase !== 'reveal' || index !== room.round || member.ready) return;
    member.ready = true;
    const waiting = this.activeUids(room).filter((id) => this.users.get(id)?.connected && !room.members.get(id)!.ready);
    if (waiting.length === 0) this.advance(room);
    else this.broadcast(room);
  }

  private advance(room: Room): void {
    if (room.phase !== 'reveal') return;
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
    if (room.round + 1 >= MP_ROUNDS) return this.finish(room);
    room.round += 1;
    room.deadline = null;
    if (room.scenes[room.round]) return this.beginRound(room);
    room.phase = 'preparing';
    if (room.requested !== room.round) this.requestScene(room, room.round);
    this.broadcast(room);
  }

  private finish(room: Room): void {
    this.clearTimers(room);
    room.phase = 'finished';
    room.deadline = null;
    room.graceActive = false;
    room.generatorUid = null;
    this.broadcast(room);
  }

  private clearTimers(room: Room): void {
    if (room.phaseTimer) clearTimeout(room.phaseTimer);
    if (room.generateTimer) clearTimeout(room.generateTimer);
    room.phaseTimer = null;
    room.generateTimer = null;
  }

  /* ---------------------------------------------------------------- helpers */

  private inMatch(room: Room): boolean {
    return room.phase === 'preparing' || room.phase === 'playing' || room.phase === 'reveal';
  }

  private activeUids(room: Room): string[] {
    return [...room.members.values()].filter((m) => !m.left).map((m) => m.uid);
  }

  private connectedUids(room: Room): string[] {
    return this.activeUids(room).filter((id) => this.users.get(id)?.connected);
  }

  private fail(user: User, code: ErrorCode, message: string): void {
    this.deps.send(user.uid, { t: 'error', code, message });
  }

  private broadcast(room: Room): void {
    if (!this.rooms.has(room.code)) return;
    for (const id of room.members.keys()) {
      const u = this.users.get(id);
      if (u?.connected && u.room === room) this.deps.send(id, { t: 'state', room: this.view(room, id) });
    }
  }

  private view(room: Room, uid: string): RoomView {
    const showScene = room.phase === 'playing' || room.phase === 'reveal';
    return {
      code: room.code,
      kind: room.kind,
      quick: room.quick,
      hostUid: room.hostUid,
      maxPlayers: MAX_PLAYERS[room.kind],
      settings: room.settings,
      roundSeconds: roundSecondsFor(room.settings),
      players: [...room.members.values()].map((m) => {
        const u = this.users.get(m.uid);
        return {
          uid: m.uid,
          name: u?.name ?? 'Player',
          photoURL: u?.photoURL ?? null,
          connected: !!u?.connected && u.room === room,
          left: m.left,
          total: m.total,
          guessed: room.phase === 'playing' && room.guesses.has(m.uid),
          ready: m.ready,
        };
      }),
      phase: room.phase,
      round: room.round,
      totalRounds: MP_ROUNDS,
      scene: showScene ? (room.scenes[room.round]?.scene ?? null) : null,
      myGuess: room.phase === 'playing' ? (room.guesses.get(uid)?.guess ?? null) : null,
      endsInMs: room.deadline != null ? Math.max(0, room.deadline - Date.now()) : null,
      graceActive: room.graceActive,
      results: room.results,
    };
  }
}
