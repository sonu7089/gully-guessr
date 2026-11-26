import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { activeProvider } from '../engine/activeProvider';
import { resolvePlayArea } from '../engine/playArea';
import { prepareRound } from '../engine/roundPlanner';
import { WS_PATH, type ClientMessage, type RoomView, type ServerMessage } from './protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'failed';

export interface MpNotice {
  id: number;
  message: string;
}

interface MpState {
  status: ConnectionStatus;
  /** Why the connection gave up (bad session, opened in another tab, server unreachable). */
  failure: string | null;
  room: RoomView | null;
  /** `Date.now()` value at which `room.endsInMs` runs out. */
  deadlineAt: number | null;
  searching: boolean;
  searchingSince: number | null;
  notice: MpNotice | null;
  /** This browser is preparing the next round for the room. */
  generating: boolean;
}

interface MpApi extends MpState {
  uid: string | null;
  connect(): void;
  send(msg: ClientMessage): void;
  dismissNotice(): void;
}

const INITIAL: MpState = { status: 'idle', failure: null, room: null, deadlineAt: null, searching: false, searchingSince: null, notice: null, generating: false };
const RETRY_MS = [1000, 2000, 4000, 8000, 15000];
const ACTIVE_KEY = 'gg.mp.active';

const MpContext = createContext<MpApi | null>(null);

function serverUrl(): string {
  const base = import.meta.env.VITE_GAME_SERVER_URL;
  if (base) return `${base.replace(/^http/, 'ws').replace(/\/$/, '')}${WS_PATH}`;
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${WS_PATH}`;
}

/** True when this tab was in a multiplayer room before a reload. */
export const wasInRoom = () => {
  try {
    return sessionStorage.getItem(ACTIVE_KEY) === '1';
  } catch {
    return false;
  }
};

function markInRoom(on: boolean) {
  try {
    if (on) sessionStorage.setItem(ACTIVE_KEY, '1');
    else sessionStorage.removeItem(ACTIVE_KEY);
  } catch {
    // ignore
  }
}

export function MultiplayerProvider({ children }: { children: ReactNode }) {
  const { player, idToken } = useAuth();
  const [state, setState] = useState<MpState>(INITIAL);
  const ws = useRef<WebSocket | null>(null);
  const wanted = useRef(false);
  const welcomed = useRef(false);
  const outbox = useRef<ClientMessage[]>([]);
  const attempt = useRef(0);
  const retryTimer = useRef(0);
  const noticeId = useRef(0);
  const roomRef = useRef<RoomView | null>(null);
  const jobs = useRef(new Set<string>());
  const playerRef = useRef(player);
  playerRef.current = player;

  const patch = useCallback((p: Partial<MpState>) => setState((s) => ({ ...s, ...p })), []);
  const notify = useCallback((message: string) => patch({ notice: { id: ++noticeId.current, message } }), [patch]);

  const rawSend = useCallback((msg: ClientMessage) => {
    const sock = ws.current;
    if (sock && sock.readyState === WebSocket.OPEN && (welcomed.current || msg.t === 'hello')) {
      sock.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const generate = useCallback(
    async (msg: Extract<ServerMessage, { t: 'generate' }>) => {
      const key = `${roomRef.current?.code}:${msg.round}`;
      if (jobs.current.has(key)) return;
      jobs.current.add(key);
      patch({ generating: true });
      try {
        const [provider, area] = await Promise.all([activeProvider(), resolvePlayArea(msg.settings)]);
        const round = await prepareRound({ provider, area, previous: msg.previous, excludeSceneIds: new Set(msg.excludeIds) });
        const place = await round.place;
        const out: ClientMessage = { t: 'scene', round: msg.round, scene: round.scene, place, archetype: round.usedFallback ? null : round.archetype };
        if (!rawSend(out)) outbox.current.push(out);
      } catch {
        jobs.current.delete(key);
        rawSend({ t: 'scene.failed', round: msg.round });
      } finally {
        patch({ generating: false });
      }
    },
    [patch, rawSend],
  );

  const onMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.t) {
        case 'welcome': {
          welcomed.current = true;
          attempt.current = 0;
          patch({ status: 'online', failure: null });
          const queued = outbox.current.splice(0);
          queued.forEach((m) => rawSend(m));
          return;
        }
        case 'state': {
          const prev = roomRef.current;
          roomRef.current = msg.room;
          markInRoom(!!msg.room);
          if (!msg.room || msg.room.code !== prev?.code) jobs.current.clear();
          patch({ room: msg.room, deadlineAt: msg.room?.endsInMs != null ? Date.now() + msg.room.endsInMs : null });
          return;
        }
        case 'queue':
          patch({ searching: msg.searching, searchingSince: msg.since });
          return;
        case 'generate':
          generate(msg);
          return;
        case 'error':
          if (msg.code === 'auth' || msg.code === 'replaced') {
            wanted.current = false;
            patch({ status: 'failed', failure: msg.message, room: null, searching: false });
          } else {
            notify(msg.message);
          }
          return;
        case 'pong':
          return;
      }
    },
    [patch, rawSend, generate, notify],
  );

  const open = useCallback(async () => {
    if (ws.current || !playerRef.current) return;
    const token = await idToken();
    const me = playerRef.current;
    if (!token || !me || !wanted.current || ws.current) return;
    patch({ status: attempt.current > 0 ? 'reconnecting' : 'connecting' });
    const sock = new WebSocket(serverUrl());
    ws.current = sock;
    welcomed.current = false;
    sock.onopen = () => rawSend({ t: 'hello', token, name: me.name, photoURL: me.photoURL });
    sock.onmessage = (e) => {
      try {
        onMessage(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        // ignore malformed frames
      }
    };
    sock.onclose = () => {
      if (ws.current === sock) ws.current = null;
      welcomed.current = false;
      if (!wanted.current) return;
      const wait = RETRY_MS[Math.min(attempt.current, RETRY_MS.length - 1)];
      attempt.current += 1;
      if (attempt.current > 8) {
        wanted.current = false;
        patch({ status: 'failed', failure: 'Can’t reach the game server. Check your connection and try again.' });
        return;
      }
      patch({ status: 'reconnecting' });
      retryTimer.current = window.setTimeout(() => open(), wait);
    };
  }, [idToken, onMessage, patch, rawSend]);

  const connect = useCallback(() => {
    if (!playerRef.current) return;
    wanted.current = true;
    if (state.status === 'failed') attempt.current = 0;
    open();
  }, [open, state.status]);

  const send = useCallback(
    (msg: ClientMessage) => {
      if (rawSend(msg)) return;
      outbox.current.push(msg);
      connect();
    },
    [rawSend, connect],
  );

  // Logging out (or switching account) drops the connection and any room view.
  useEffect(() => {
    if (player) return;
    wanted.current = false;
    window.clearTimeout(retryTimer.current);
    ws.current?.close();
    ws.current = null;
    roomRef.current = null;
    outbox.current = [];
    markInRoom(false);
    setState(INITIAL);
  }, [player]);

  useEffect(
    () => () => {
      wanted.current = false;
      window.clearTimeout(retryTimer.current);
      ws.current?.close();
    },
    [],
  );

  // Keep-alive so idle proxies don't cut the socket.
  useEffect(() => {
    if (state.status !== 'online') return;
    const id = window.setInterval(() => rawSend({ t: 'ping' }), 20_000);
    return () => window.clearInterval(id);
  }, [state.status, rawSend]);

  const api = useMemo<MpApi>(
    () => ({ ...state, uid: player?.uid ?? null, connect, send, dismissNotice: () => patch({ notice: null }) }),
    [state, player?.uid, connect, send, patch],
  );
  return <MpContext.Provider value={api}>{children}</MpContext.Provider>;
}

export function useMultiplayer(): MpApi {
  const ctx = useContext(MpContext);
  if (!ctx) throw new Error('useMultiplayer must be used inside <MultiplayerProvider>');
  return ctx;
}
