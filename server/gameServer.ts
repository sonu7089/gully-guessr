import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { WS_PATH, type ClientMessage, type ServerMessage } from '../src/multiplayer/protocol';
import { sizeKmFor } from './areas';
import { firebaseVerifier, type TokenVerifier } from './auth';
import { Lobby } from './lobby';

export interface GameServerOptions {
  projectId?: string;
  /** Overrides Firebase token verification (tests). */
  verify?: TokenVerifier;
  log?: (msg: string) => void;
}

const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 25_000;
const MAX_MESSAGE_BYTES = 32 * 1024;

type Socket = WebSocket & { alive?: boolean };

/** Adds the multiplayer WebSocket endpoint at `/ws` to an existing HTTP server. */
export function attachGameServer(server: Server, opts: GameServerOptions = {}): { lobby: Lobby; close(): void } {
  const log = opts.log ?? (() => undefined);
  const verify = opts.verify ?? (opts.projectId ? firebaseVerifier(opts.projectId) : null);
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const sockets = new Map<string, Socket>();

  const send = (ws: WebSocket, msg: ServerMessage) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  };
  const lobby = new Lobby({
    send: (uid, msg) => {
      const ws = sockets.get(uid);
      if (ws) send(ws, msg);
    },
    sizeKmFor,
  });

  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== WS_PATH) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  };
  server.on('upgrade', onUpgrade);

  wss.on('connection', (ws: Socket) => {
    let uid: string | null = null;
    let verifying = false;
    ws.alive = true;
    ws.on('pong', () => (ws.alive = true));
    const helloTimer = setTimeout(() => uid || ws.close(4001, 'hello required'), HELLO_TIMEOUT_MS);

    ws.on('message', async (raw) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (uid) return lobby.handle(uid, msg);
      if (msg?.t !== 'hello' || verifying) return;
      if (!verify) {
        send(ws, { t: 'error', code: 'auth', message: 'Multiplayer is not configured on this server.' });
        return ws.close(4003, 'no auth');
      }
      verifying = true;
      try {
        const user = await verify(String(msg.token));
        if (ws.readyState !== WebSocket.OPEN) return;
        clearTimeout(helloTimer);
        uid = user.uid;
        const previous = sockets.get(uid);
        sockets.set(uid, ws);
        if (previous && previous !== ws) {
          send(previous, { t: 'error', code: 'replaced', message: 'You opened the game in another tab.' });
          previous.close(4000, 'replaced');
        }
        lobby.connect(uid, msg.name || user.name || '', msg.photoURL ?? user.picture);
        log(`connected ${uid}`);
      } catch {
        send(ws, { t: 'error', code: 'auth', message: 'Your session expired. Log in again.' });
        ws.close(4003, 'bad token');
      } finally {
        verifying = false;
      }
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (uid && sockets.get(uid) === ws) {
        sockets.delete(uid);
        lobby.disconnect(uid);
        log(`disconnected ${uid}`);
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<Socket>) {
      if (!ws.alive) {
        ws.terminate();
        continue;
      }
      ws.alive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);

  return {
    lobby,
    close() {
      clearInterval(heartbeat);
      server.off('upgrade', onUpgrade);
      for (const ws of wss.clients) ws.terminate();
      wss.close();
    },
  };
}
