import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { Button, Eyebrow, PlayIcon } from '../components/ui';
import type { ImageryProvider } from '../engine/imageryProviders';
import type { GameSettings } from '../engine/types';
import { MatchResults } from '../multiplayer/MatchResults';
import { MatchScreen } from '../multiplayer/MatchScreen';
import { useMultiplayer } from '../multiplayer/MultiplayerProvider';
import { CODE_LENGTH, normalizeCode, type RoomKind } from '../multiplayer/protocol';
import { RoomLobby } from '../multiplayer/RoomLobby';
import { formatClock } from '../components/Hud';

interface MultiplayerPageProps {
  settings: GameSettings;
  provider: ImageryProvider;
  /** Room code from an invite link, joined once the player is logged in. */
  inviteCode: string | null;
  onInviteHandled: () => void;
  onHome: () => void;
  onSinglePlayer: () => void;
}

export function MultiplayerPage({ settings, provider, inviteCode, onInviteHandled, onHome, onSinglePlayer }: MultiplayerPageProps) {
  const { enabled, ready, player, openAuth } = useAuth();
  const mp = useMultiplayer();
  const { connect, send, room } = mp;

  useEffect(() => {
    if (player) connect();
  }, [player, connect]);

  useEffect(() => {
    if (!inviteCode || !ready) return;
    if (!player) {
      openAuth('signup', `Log in or sign up to join room ${inviteCode}.`);
      return;
    }
    send({ t: 'room.join', code: inviteCode });
    onInviteHandled();
  }, [inviteCode, ready, player, send, openAuth, onInviteHandled]);

  useEffect(() => {
    if (!mp.notice) return;
    const id = window.setTimeout(mp.dismissNotice, 4500);
    return () => window.clearTimeout(id);
  }, [mp.notice, mp.dismissNotice]);

  const notice = mp.notice && (
    <div className="toast toast--error" role="alert" key={mp.notice.id}>
      {mp.notice.message}
    </div>
  );

  if (room && player) {
    if (room.phase === 'lobby') {
      return (
        <>
          <RoomLobby room={room} onHome={onHome} />
          {notice}
        </>
      );
    }
    if (room.phase === 'finished') {
      return (
        <>
          <MatchResults room={room} />
          {notice}
        </>
      );
    }
    return (
      <>
        <MatchScreen room={room} />
        {notice}
      </>
    );
  }

  return (
    <>
      <Header onPlayNow={onSinglePlayer} onHome={onHome} sections={false} />
      <div className="stars" aria-hidden="true" />
      <main className="mp container" aria-labelledby="mp-title">
        <div className="mp__head">
          <Eyebrow>Play with friends or strangers</Eyebrow>
          <h1 id="mp-title" className="mp__title">
            Multiplayer
          </h1>
          <p>Everyone gets the same five streets. Closest pins win.</p>
          <ConnectionChip />
        </div>
        {!enabled ? (
          <div className="panel mp__gate">
            <h2 className="h3">Multiplayer isn’t set up</h2>
            <p>Add the Firebase keys to <code>.env</code> to turn on accounts and multiplayer.</p>
          </div>
        ) : !player ? (
          <div className="panel mp__gate">
            <h2 className="h3">Log in to play multiplayer</h2>
            <p>Your player name shows up for opponents, and your matches are tied to your account.</p>
            <div className="mp__gate-actions">
              <Button size="lg" onClick={() => openAuth('signup', 'Create an account to play multiplayer.')}>
                Sign up
              </Button>
              <Button size="lg" variant="secondary" onClick={() => openAuth('login')}>
                Log in
              </Button>
            </div>
          </div>
        ) : (
          <Hub settings={settings} />
        )}
      </main>
      <Footer provider={provider.id} />
      {notice}
    </>
  );
}

function ConnectionChip() {
  const { player } = useAuth();
  const { status, failure, connect } = useMultiplayer();
  if (!player || status === 'online' || status === 'idle') return null;
  if (status === 'failed') {
    return (
      <p className="conn conn--bad" role="alert">
        {failure}{' '}
        <button type="button" className="link-quiet" onClick={connect}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <p className="conn" role="status">
      <span className="conn__dot" aria-hidden="true" />
      {status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…'}
    </p>
  );
}

const MODES: { kind: RoomKind; badge: string; title: string; body: string; cta: string }[] = [
  { kind: 'duel', badge: '1v1', title: 'Duel a friend', body: 'A private room for two. Send your friend the code and go head to head.', cta: 'Create 1v1 room' },
  { kind: 'party', badge: '2–4 players', title: 'Party room', body: 'Up to four players, same locations, highest total after five rounds wins.', cta: 'Create party room' },
];

function Hub({ settings }: { settings: GameSettings }) {
  const { send, searching, searchingSince, status } = useMultiplayer();
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const offline = status !== 'online';

  useEffect(() => {
    if (!searching) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [searching]);

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = normalizeCode(code);
    if (c.length === CODE_LENGTH) send({ t: 'room.join', code: c });
  };

  return (
    <div className="mp__grid">
      <section className={`mode-card mode-card--quick${searching ? ' mode-card--searching' : ''}`} aria-labelledby="quick-title">
        <span className="mode-card__badge">1v1 · Random</span>
        <h2 id="quick-title" className="mode-card__title">
          Quick match
        </h2>
        <p className="mode-card__body">Get paired with the next player who’s looking. All India, moving allowed, 2-minute rounds.</p>
        {searching ? (
          <div className="searching" role="status">
            <span className="searching__radar" aria-hidden="true">
              <span />
              <span />
            </span>
            <div>
              <strong>Looking for an opponent…</strong>
              <span>{searchingSince ? formatClock((now - searchingSince) / 1000) : '0:00'}</span>
            </div>
            <Button variant="ghost" onClick={() => send({ t: 'queue.leave' })}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="lg" onClick={() => send({ t: 'queue.join' })} disabled={offline} icon={<PlayIcon />}>
            Find a match
          </Button>
        )}
      </section>

      {MODES.map((m) => (
        <section key={m.kind} className="mode-card" aria-labelledby={`${m.kind}-title`}>
          <span className="mode-card__badge">{m.badge}</span>
          <h2 id={`${m.kind}-title`} className="mode-card__title">
            {m.title}
          </h2>
          <p className="mode-card__body">{m.body}</p>
          <Button size="lg" variant="secondary" disabled={offline || searching} onClick={() => send({ t: 'room.create', kind: m.kind, settings })}>
            {m.cta}
          </Button>
        </section>
      ))}

      <form className="panel join-code" onSubmit={join}>
        <div>
          <h2 className="h3">Have a room code?</h2>
          <p>Ask the host for the {CODE_LENGTH}-letter code.</p>
        </div>
        <input
          className="join-code__input"
          value={code}
          onChange={(e) => setCode(normalizeCode(e.target.value))}
          placeholder="ABCDE"
          aria-label="Room code"
          autoComplete="off"
          spellCheck={false}
          maxLength={CODE_LENGTH}
        />
        <Button type="submit" size="lg" disabled={offline || searching || normalizeCode(code).length !== CODE_LENGTH}>
          Join
        </Button>
      </form>
    </div>
  );
}
