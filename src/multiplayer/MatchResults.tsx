import { useMemo, useState } from 'react';
import { SummaryMap } from '../components/Maps';
import { Avatar } from '../components/UserMenu';
import { Button, Eyebrow, PlayIcon, useCountUp } from '../components/ui';
import { MAX_GAME_SCORE } from '../config';
import { playAreaLabel } from '../engine/playArea';
import { formatDistance, formatScore } from '../utils/scoring';
import { RULESET_INFO } from '../utils/labels';
import { useRoomArea } from './MatchScreen';
import { useMultiplayer } from './MultiplayerProvider';
import { seatColor, standings } from './players';
import type { PlayerView, RoomView } from './protocol';

function Headline({ room, uid }: { room: RoomView; uid: string | null }) {
  const ranked = standings(room);
  const top = ranked[0];
  const tied = ranked.filter((p) => p.total === top.total).length > 1;
  const opponentsLeft = room.players.filter((p) => p.uid !== uid).every((p) => p.left);
  if (opponentsLeft && room.players.length > 1) return <>Your opponent left. You win!</>;
  if (tied) return <>It’s a draw!</>;
  if (top.uid === uid) return <>You win!</>;
  return <>{top.name} wins</>;
}

function TotalRow({ room, p, rank, me }: { room: RoomView; p: PlayerView; rank: number; me: boolean }) {
  const shown = useCountUp(p.total, 1200, 0);
  return (
    <li className={`podium__row${me ? ' podium__row--me' : ''}${rank === 0 ? ' podium__row--first' : ''}`} style={{ ['--seat' as string]: seatColor(room, p.uid) }}>
      <span className="podium__rank">{rank + 1}</span>
      <Avatar player={p} size={40} />
      <span className="podium__name">
        <strong>{me ? `${p.name} (you)` : p.name}</strong>
        {p.left && <span>Left the match</span>}
      </span>
      <span className="podium__bar" aria-hidden="true">
        <span style={{ width: `${(p.total / MAX_GAME_SCORE) * 100}%` }} />
      </span>
      <span className="podium__total">{formatScore(shown)}</span>
    </li>
  );
}

export function MatchResults({ room }: { room: RoomView }) {
  const { uid, send } = useMultiplayer();
  const area = useRoomArea(room);
  const [selected, setSelected] = useState<number | null>(null);
  const isHost = room.hostUid === uid;
  const ranked = standings(room);
  const vectors = useMemo(
    () =>
      room.results.map((r) => ({
        actual: r.scene,
        guess: r.guesses.find((g) => g.uid === uid)?.guess ?? null,
        label: String(r.index + 1),
      })),
    [room.results, uid],
  );

  return (
    <>
      <div className="stars" aria-hidden="true" />
      <main className="mp-results container" aria-labelledby="mp-final-title">
        <section className="panel final">
          <Eyebrow>
            {room.quick ? 'Quick match' : room.kind === 'duel' ? '1v1' : 'Party'} · {playAreaLabel(room.settings)} · {RULESET_INFO[room.settings.ruleset].label}
          </Eyebrow>
          <h1 id="mp-final-title" className="mp-results__title">
            <Headline room={room} uid={uid} />
          </h1>
          <ol className="podium">
            {ranked.map((p, i) => (
              <TotalRow key={p.uid} room={room} p={p} rank={i} me={p.uid === uid} />
            ))}
          </ol>
          <div className="mp-results__actions">
            {room.quick ? (
              <>
                <Button size="lg" onClick={() => send({ t: 'queue.join' })} icon={<PlayIcon />}>
                  Find a new opponent
                </Button>
                <Button size="lg" variant="secondary" onClick={() => send({ t: 'room.leave' })}>
                  Back to multiplayer
                </Button>
              </>
            ) : (
              <>
                {isHost ? (
                  <Button size="lg" onClick={() => send({ t: 'room.rematch' })} icon={<PlayIcon />}>
                    Rematch
                  </Button>
                ) : (
                  <p className="room__waiting">
                    <span className="conn__dot" aria-hidden="true" /> The host can start a rematch
                  </p>
                )}
                <Button size="lg" variant="secondary" onClick={() => send({ t: 'room.leave' })}>
                  Leave room
                </Button>
              </>
            )}
          </div>
        </section>

        {area && room.results.length > 0 && (
          <div className="summary__map">
            <SummaryMap area={area} vectors={vectors} selected={selected} onSelect={(i) => setSelected((s) => (s === i ? null : i))} />
          </div>
        )}

        <section className="panel breakdown" aria-labelledby="breakdown-title">
          <h2 id="breakdown-title" className="room__section-title">
            Round by round
          </h2>
          <div className="breakdown__scroll">
            <table className="breakdown__table">
              <thead>
                <tr>
                  <th scope="col">Round</th>
                  {room.players.map((p) => (
                    <th key={p.uid} scope="col">
                      <span className="scoreboard__dot" style={{ background: seatColor(room, p.uid) }} aria-hidden="true" /> {p.uid === uid ? 'You' : p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {room.results.map((r) => {
                  const best = Math.max(...r.guesses.map((g) => g.points));
                  return (
                    <tr key={r.index} className={selected === r.index ? 'is-selected' : ''} onClick={() => setSelected((s) => (s === r.index ? null : r.index))}>
                      <th scope="row">
                        <strong>{r.index + 1}</strong>
                        <span>
                          {r.place.locality}, {r.place.stateName}
                        </span>
                      </th>
                      {room.players.map((p) => {
                        const g = r.guesses.find((x) => x.uid === p.uid);
                        return (
                          <td key={p.uid} className={g && g.points === best && best > 0 ? 'is-best' : ''}>
                            <strong>{g ? formatScore(g.points) : '—'}</strong>
                            <span>{g?.guess ? formatDistance(g.distanceKm) : 'No guess'}</span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  {room.players.map((p) => (
                    <td key={p.uid}>
                      <strong>{formatScore(p.total)}</strong>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
