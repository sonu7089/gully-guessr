import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import type { GameSettings } from '../engine/types';
import { Avatar } from '../components/UserMenu';
import { Button, Eyebrow, PlayIcon } from '../components/ui';
import { useMultiplayer } from './MultiplayerProvider';
import { inviteLink, seatColor } from './players';
import type { RoomView } from './protocol';
import { RoomSettings } from './RoomSettings';

export function RoomLobby({ room, onHome }: { room: RoomView; onHome: () => void }) {
  const { uid, send } = useMultiplayer();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  // The host's edits show immediately and build on each other until the server echoes them back.
  const [draft, setDraft] = useState<GameSettings | null>(null);
  const settings = draft ?? room.settings;
  const confirmed = JSON.stringify(room.settings);
  useEffect(() => {
    setDraft((d) => (d && JSON.stringify(d) === confirmed ? null : d));
  }, [confirmed]);
  const changeSettings = (next: GameSettings) => {
    setDraft(next);
    send({ t: 'room.settings', settings: next });
  };
  const isHost = room.hostUid === uid;
  const online = room.players.filter((p) => p.connected).length;
  const canStart = isHost && online >= 2;
  const seats = Array.from({ length: room.maxPlayers }, (_, i) => room.players[i] ?? null);

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? room.code : inviteLink(room.code));
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard blocked; the code is on screen anyway.
    }
  };

  return (
    <>
      <Header onHome={onHome} sections={false} />
      <div className="stars" aria-hidden="true" />
      <main className="room container" aria-labelledby="room-title">
        <div className="room__head">
          <Eyebrow>{room.kind === 'duel' ? '1v1 room' : `Party room · up to ${room.maxPlayers} players`}</Eyebrow>
          <h1 id="room-title" className="room__title">
            Waiting for players
          </h1>
          <div className="room-code">
            <span className="room-code__label">Room code</span>
            <span className="room-code__value" aria-label={`Room code ${room.code.split('').join(' ')}`}>
              {room.code.split('').map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </span>
            <div className="room-code__actions">
              <Button size="sm" variant="secondary" onClick={() => copy('code')}>
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => copy('link')}>
                {copied === 'link' ? 'Link copied' : 'Copy invite link'}
              </Button>
            </div>
          </div>
        </div>

        <div className="room__grid">
          <section className="panel room__players" aria-labelledby="players-title">
            <h2 id="players-title" className="room__section-title">
              Players <span>{room.players.length} / {room.maxPlayers}</span>
            </h2>
            <ul className="seats">
              {seats.map((p, i) =>
                p ? (
                  <li key={p.uid} className={`seat${p.connected ? '' : ' seat--away'}`} style={{ ['--seat' as string]: seatColor(room, p.uid) }}>
                    <Avatar player={p} size={44} />
                    <div className="seat__who">
                      <strong>
                        {p.name}
                        {p.uid === uid && <span className="seat__you"> (you)</span>}
                      </strong>
                      <span>{p.uid === room.hostUid ? 'Host' : p.connected ? 'Ready' : 'Reconnecting…'}</span>
                    </div>
                    {isHost && p.uid !== uid && (
                      <button type="button" className="link-quiet seat__kick" onClick={() => send({ t: 'room.kick', uid: p.uid })}>
                        Remove
                      </button>
                    )}
                  </li>
                ) : (
                  <li key={`empty-${i}`} className="seat seat--empty">
                    <span className="seat__placeholder" aria-hidden="true" />
                    <div className="seat__who">
                      <strong>Open seat</strong>
                      <span>Share the code to invite someone</span>
                    </div>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section className="panel room__rules" aria-labelledby="rules-title">
            <h2 id="rules-title" className="room__section-title">
              Game settings {!isHost && <span>Set by the host</span>}
            </h2>
            <RoomSettings settings={settings} roundSeconds={settings.timer || room.roundSeconds} editable={isHost} onChange={changeSettings} />
            <p className="room__note">5 rounds. When someone guesses, everyone else has 15 seconds left.</p>
          </section>
        </div>

        <div className="room__actions">
          <Button variant="ghost" onClick={() => send({ t: 'room.leave' })}>
            Leave room
          </Button>
          {isHost ? (
            <Button size="lg" onClick={() => send({ t: 'room.start' })} disabled={!canStart} icon={<PlayIcon />}>
              {canStart ? 'Start game' : 'Need 2 players to start'}
            </Button>
          ) : (
            <p className="room__waiting">
              <span className="conn__dot" aria-hidden="true" /> Waiting for the host to start…
            </p>
          )}
        </div>
      </main>
    </>
  );
}
