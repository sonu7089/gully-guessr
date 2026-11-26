import { useCallback, useEffect, useRef, useState } from 'react';
import { Compass } from '../components/Compass';
import { formatClock } from '../components/Hud';
import { LocatingOverlay } from '../components/LocatingOverlay';
import { GuessMap, PlayersResultMap, type ResultView } from '../components/Maps';
import { Avatar } from '../components/UserMenu';
import { Button, Eyebrow, Segmented } from '../components/ui';
import { SceneViewer, type ViewerHandle } from '../components/viewers/SceneViewer';
import { MAX_ROUND_SCORE } from '../config';
import { playAreaLabel, resolvePlayArea, type PlayArea } from '../engine/playArea';
import type { LatLng } from '../engine/types';
import { formatDistance, formatScore } from '../utils/scoring';
import { useMultiplayer } from './MultiplayerProvider';
import { playerName, seatColor, standings } from './players';
import type { RoomView } from './protocol';

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Seconds left on the server's clock for the current phase. */
function useCountdown(deadlineAt: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadlineAt == null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [deadlineAt]);
  return deadlineAt == null ? null : Math.max(0, (deadlineAt - now) / 1000);
}

/** Resolves the room's play area, re-resolving only when the settings actually change. */
export function useRoomArea(room: RoomView): PlayArea | null {
  const [area, setArea] = useState<PlayArea | null>(null);
  const settings = useRef(room.settings);
  const key = JSON.stringify(room.settings);
  settings.current = room.settings;
  useEffect(() => {
    let alive = true;
    resolvePlayArea(settings.current).then((a) => alive && setArea(a));
    return () => {
      alive = false;
    };
  }, [key]);
  return area;
}

export function MatchScreen({ room }: { room: RoomView }) {
  const area = useRoomArea(room);

  const label = playAreaLabel(room.settings);
  if (!area || room.phase === 'preparing' || !room.scene) {
    return (
      <main className="game" aria-label="Multiplayer match">
        <LocatingOverlay round={room.round} areaLabel={label} line="Getting everyone the same street…">
          <ul className="locating__players">
            {room.players
              .filter((p) => !p.left)
              .map((p) => (
                <li key={p.uid} style={{ ['--seat' as string]: seatColor(room, p.uid) }}>
                  <Avatar player={p} size={28} />
                  {p.name}
                  {room.round > 0 && <strong>{formatScore(p.total)}</strong>}
                </li>
              ))}
          </ul>
        </LocatingOverlay>
      </main>
    );
  }

  if (room.phase === 'reveal') return <MatchReveal room={room} area={area} />;
  return <MatchRound key={`${room.code}-${room.round}`} room={room} area={area} />;
}

function Scoreboard({ room }: { room: RoomView }) {
  const { uid } = useMultiplayer();
  return (
    <div className="scoreboard" role="status" aria-label="Scores">
      <div className="scoreboard__round">
        <span className="status__label">Round</span>
        <span className="status__value">
          {room.round + 1} / {room.totalRounds}
        </span>
      </div>
      <ol className="scoreboard__list">
        {standings(room).map((p) => (
          <li key={p.uid} className={`scoreboard__row${p.left ? ' scoreboard__row--left' : ''}${p.connected ? '' : ' scoreboard__row--away'}`}>
            <span className="scoreboard__dot" style={{ background: seatColor(room, p.uid) }} aria-hidden="true" />
            <span className="scoreboard__name">{p.uid === uid ? 'You' : p.name}</span>
            {room.phase === 'playing' && (
              <span className={`scoreboard__state${p.guessed ? ' scoreboard__state--done' : ''}`} title={p.guessed ? 'Guessed' : 'Still looking'}>
                {p.guessed ? '✓' : '…'}
              </span>
            )}
            <span className="scoreboard__total">{formatScore(p.total)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LeaveButton() {
  const { send } = useMultiplayer();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button className="hud-exit" onClick={() => setConfirm(true)} aria-label="Leave match" title="Leave match">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {confirm && (
        <div className="leave-confirm" role="alertdialog" aria-label="Leave match?">
          <strong>Leave this match?</strong>
          <p>You can’t rejoin, and in a 1v1 your opponent wins.</p>
          <div>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)} autoFocus>
              Stay
            </Button>
            <Button size="sm" variant="secondary" onClick={() => send({ t: 'room.leave' })}>
              Leave
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function MatchRound({ room, area }: { room: RoomView; area: PlayArea }) {
  const { uid, send, deadlineAt } = useMultiplayer();
  const scene = room.scene!;
  const [viewScene, setViewScene] = useState(scene);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [sent, setSent] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const viewerRef = useRef<ViewerHandle>(null);
  const timeLeft = useCountdown(deadlineAt);
  const locked = sent || !!room.myGuess;
  const pin = room.myGuess ?? guess;
  const expanded = !locked && (pinned || hovered);
  const othersGuessed = room.players.filter((p) => p.uid !== uid && p.guessed).length;
  const total = room.graceActive ? 15 : room.roundSeconds;
  const low = timeLeft != null && timeLeft <= 10;

  const submit = useCallback(() => {
    if (!guess || locked) return;
    setSent(true);
    setPinned(false);
    setSheetOpen(false);
    send({ t: 'guess', round: room.round, guess });
  }, [guess, locked, send, room.round]);

  // When the clock runs out, a placed-but-unsent pin still counts.
  useEffect(() => {
    if (timeLeft === 0 && guess && !locked) submit();
  }, [timeLeft, guess, locked, submit]);

  const keys = useRef({ submit });
  keys.current = { submit };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === ' ') {
        e.preventDefault();
        keys.current.submit();
      } else if (e.key === 'm' || e.key === 'M') {
        setPinned((p) => !p);
        setSheetOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setPinned(false);
        setSheetOpen(false);
      } else if (e.key === 'r' || e.key === 'R') {
        viewerRef.current?.resetView();
        setViewScene(scene);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene]);

  const onHeading = useCallback((h: number | null) => setHeading(h), []);
  const noop = useCallback(() => undefined, []);

  return (
    <main className="game game--mp" aria-label="Multiplayer match">
      <SceneViewer key={viewScene.id} ref={viewerRef} scene={viewScene} ruleset={room.settings.ruleset} onHeading={onHeading} onReady={noop} onError={noop} />

      <LeaveButton />
      {timeLeft != null && (
        <div className={`hud-timer${low ? ' hud-timer--low' : ''}${room.graceActive ? ' hud-timer--grace' : ''}`} role="timer" aria-label={`${Math.ceil(timeLeft)} seconds left`}>
          <span className="hud-timer__clock">{formatClock(timeLeft)}</span>
          <span className="hud-timer__track" aria-hidden="true">
            <span className="hud-timer__fill" style={{ width: `${Math.min(100, (timeLeft / total) * 100)}%` }} />
          </span>
        </div>
      )}
      {room.graceActive && !locked && othersGuessed > 0 && (
        <div className="grace-banner" role="alert">
          {othersGuessed === 1 ? `${room.players.find((p) => p.uid !== uid && p.guessed)?.name ?? 'Someone'} guessed` : `${othersGuessed} players guessed`} · hurry up!
        </div>
      )}
      <Scoreboard room={room} />

      <div className="controls" aria-label="View controls">
        <button
          className="ctrl"
          onClick={() => {
            viewerRef.current?.resetView();
            setViewScene(scene);
          }}
          aria-label="Back to start (R)"
          title="Back to start (R)"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v3h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {room.settings.ruleset !== 'nmpz' && (
          <div className="ctrl-row">
            <button className="ctrl" onClick={() => viewerRef.current?.zoomIn()} aria-label="Zoom in" title="Zoom in (+)">
              +
            </button>
            <button className="ctrl" onClick={() => viewerRef.current?.zoomOut()} aria-label="Zoom out" title="Zoom out (−)">
              −
            </button>
          </div>
        )}
        <Compass heading={heading} />
      </div>

      <div
        className={`guess${expanded ? ' guess--expanded' : ''}${sheetOpen ? ' guess--sheet-open' : ''}${pin ? ' guess--has-pin' : ''}${locked ? ' guess--locked' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="guess__map">
          <GuessMap area={area} guess={pin} onGuess={setGuess} disabled={locked} sizeToken={`${expanded}-${sheetOpen}`} compact={!expanded && !sheetOpen} />
        </div>
        <div className="guess__buttons">
          <Button variant="secondary" size="lg" className="guess__sheet-toggle" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
            {sheetOpen ? 'Hide map' : 'Map'}
          </Button>
          <Button size="lg" block disabled={!guess || locked} onClick={submit} className="guess__go">
            {locked ? 'Waiting for the others…' : guess ? 'Guess' : 'Place your pin on the map'}
          </Button>
        </div>
      </div>
    </main>
  );
}

const VIEWS: { id: ResultView; label: string }[] = [
  { id: 'both', label: 'All pins' },
  { id: 'spot', label: 'Location' },
  { id: 'area', label: 'Whole map' },
];

function MatchReveal({ room, area }: { room: RoomView; area: PlayArea }) {
  const { uid, send, deadlineAt } = useMultiplayer();
  const [view, setView] = useState<ResultView>('both');
  const result = room.results[room.results.length - 1];
  const left = useCountdown(deadlineAt);
  const me = room.players.find((p) => p.uid === uid);
  const active = room.players.filter((p) => !p.left && p.connected);
  const readyCount = active.filter((p) => p.ready).length;
  const last = room.round + 1 >= room.totalRounds;
  const ranked = [...result.guesses].sort((a, b) => b.points - a.points);
  const pins = result.guesses.flatMap((g) =>
    g.guess ? [{ point: g.guess, color: seatColor(room, g.uid), label: playerName(room, g.uid, null).slice(0, 1).toUpperCase(), caption: playerName(room, g.uid, uid) }] : [],
  );
  const where = [result.place.district && result.place.district !== result.place.locality ? result.place.district : null, result.place.stateName].filter(Boolean).join(', ');

  const ready = useCallback(() => {
    if (!me?.ready) send({ t: 'ready', round: room.round });
  }, [me?.ready, send, room.round]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !isTypingTarget(e.target)) {
        e.preventDefault();
        ready();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ready]);

  return (
    <section className="result result--mp" aria-labelledby="mp-result-title">
      <div className="result__map">
        <PlayersResultMap area={area} actual={result.scene} pins={pins} view={view} />
        <Segmented className="result__views" name="Map view" value={view} options={VIEWS} onChange={setView} />
        <Scoreboard room={room} />
      </div>
      <div className="result__bar">
        <div className="result__inner">
          <div className="result__place">
            <Eyebrow>
              <span className="legend-dot legend-dot--actual" aria-hidden="true" /> Correct location
            </Eyebrow>
            <h3 className="result__locality">{result.place.locality}</h3>
            {where && <p className="result__where">{where}</p>}
          </div>

          <div className="round-table">
            <Eyebrow>
              Round {room.round + 1} / {room.totalRounds}
            </Eyebrow>
            <h2 id="mp-result-title" className="visually-hidden">
              Round results
            </h2>
            <ol>
              {ranked.map((g, i) => (
                <li key={g.uid} className={`round-table__row${g.uid === uid ? ' round-table__row--me' : ''}`}>
                  <span className="round-table__rank">{i + 1}</span>
                  <span className="scoreboard__dot" style={{ background: seatColor(room, g.uid) }} aria-hidden="true" />
                  <span className="round-table__name">{playerName(room, g.uid, uid)}</span>
                  <span className="round-table__dist">{g.guess ? formatDistance(g.distanceKm) : 'No guess'}</span>
                  <span className="round-table__bar" aria-hidden="true">
                    <span style={{ width: `${(g.points / MAX_ROUND_SCORE) * 100}%`, background: seatColor(room, g.uid) }} />
                  </span>
                  <span className="round-table__pts">+{formatScore(g.points)}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="result__actions">
            <Button size="lg" block onClick={ready} disabled={!!me?.ready}>
              {me?.ready ? `Waiting (${readyCount}/${active.length})` : last ? 'See final results' : 'Next round'}
            </Button>
            <span className="result__hint">
              {last ? 'Final results' : 'Next round'} in {left != null ? Math.ceil(left) : '…'}s
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
