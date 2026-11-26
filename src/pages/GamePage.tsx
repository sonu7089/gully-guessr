import { useCallback, useEffect, useRef, useState } from 'react';
import { ROUNDS_PER_GAME } from '../config';
import { Compass } from '../components/Compass';
import { Hud } from '../components/Hud';
import { LocatingOverlay } from '../components/LocatingOverlay';
import { GuessMap } from '../components/Maps';
import { RoundReveal } from '../components/RoundReveal';
import { Button } from '../components/ui';
import { SceneViewer, type ViewerHandle } from '../components/viewers/SceneViewer';
import { RoundQueue } from '../engine/gameSession';
import { pickFromFallbackPool, type ImageryProvider, type Scene } from '../engine/imageryProviders';
import type { PlayArea } from '../engine/playArea';
import { resolvePlace, stateOfPoint, type PreparedRound, type RevealedPlace } from '../engine/roundPlanner';
import type { GameSettings, LatLng, StateCode } from '../engine/types';
import { haversineKm, scoreForDistance } from '../utils/scoring';
import { loadRecentAnchors, loadRecentScenes, pushRecentAnchors, pushRecentScenes, type RoundRecord } from '../utils/storage';

export interface CompletedGame {
  settings: GameSettings;
  area: PlayArea;
  providerId: ImageryProvider['id'];
  rounds: RoundRecord[];
  total: number;
}

interface RevealState {
  distanceKm: number | null;
  points: number;
  timeTakenSec: number;
  timedOut: boolean;
  place: RevealedPlace | null;
  guessState: StateCode | null | undefined;
}

type Phase = 'locating' | 'playing' | 'reveal';

interface GamePageProps {
  settings: GameSettings;
  area: PlayArea;
  provider: ImageryProvider;
  onExit: () => void;
  onComplete: (game: CompletedGame) => void;
}

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function GamePage({ settings, area, provider, onExit, onComplete }: GamePageProps) {
  const [queue, setQueue] = useState<RoundQueue | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('locating');
  const [prepared, setPrepared] = useState<PreparedRound | null>(null);
  const [viewScene, setViewScene] = useState<Scene | null>(null);
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [heading, setHeading] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(settings.timer || null);
  const [records, setRecords] = useState<RoundRecord[]>([]);
  const [reveal, setReveal] = useState<RevealState | null>(null);

  const viewerRef = useRef<ViewerHandle>(null);
  const startedAt = useRef(0);
  const usedScenes = useRef<string[]>([]);
  const recovered = useRef(false);
  const busy = useRef(false);

  const totalScore = records.reduce((s, r) => s + r.points, 0) + (reveal?.points ?? 0);
  const scene = prepared?.scene ?? null;
  const expanded = pinned || hovered;

  // Queue lives inside an effect so React StrictMode remounts get a fresh, un-aborted queue.
  useEffect(() => {
    const q = new RoundQueue(provider, area, loadRecentAnchors(), loadRecentScenes());
    setQueue(q);
    return () => q.dispose();
  }, [provider, area]);

  useEffect(() => {
    if (!queue) return;
    let cancelled = false;
    setPhase('locating');
    queue.get(index).then(
      (round) => {
        if (cancelled) return;
        recovered.current = false;
        busy.current = false;
        setPrepared(round);
        setViewScene(round.scene);
        setPhase('playing');
        startedAt.current = performance.now();
        setTimeLeft(settings.timer || null);
        queue.prefetch(index + 1);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [queue, index, settings.timer]);

  const submit = useCallback(
    (timedOut = false) => {
      if (phase !== 'playing' || !prepared || busy.current) return;
      busy.current = true;
      const actual = prepared.scene;
      const distanceKm = guess ? haversineKm(guess, actual) : null;
      const points = scoreForDistance(distanceKm, area.sizeKm);
      const timeTakenSec = Math.round((performance.now() - startedAt.current) / 1000);
      setPhase('reveal');
      setPinned(false);
      setSheetOpen(false);
      setReveal({ distanceKm, points, timeTakenSec, timedOut, place: null, guessState: undefined });
      prepared.place.then((place) => setReveal((r) => (r ? { ...r, place } : r)));
      // Inside a single state or city every pin is in the "right state", so the badge only means something India-wide.
      if (guess && area.scope === 'india') {
        stateOfPoint(guess, provider.id === 'google').then((guessState) => setReveal((r) => (r ? { ...r, guessState } : r)));
      } else {
        setReveal((r) => (r ? { ...r, guessState: null } : r));
      }
    },
    [phase, prepared, guess, provider.id, area],
  );

  const next = useCallback(() => {
    if (phase !== 'reveal' || !reveal?.place || !prepared || !busy.current) return;
    busy.current = false;
    const place = reveal.place;
    const record: RoundRecord = {
      index,
      actual: { lat: prepared.scene.lat, lng: prepared.scene.lng },
      guess,
      distanceKm: reveal.distanceKm,
      points: reveal.points,
      timeTakenSec: reveal.timeTakenSec,
      locality: place.locality,
      stateCode: place.stateCode,
      stateName: place.stateName,
      archetype: prepared.usedFallback ? 'curated' : prepared.archetype,
      correctState: !!place.stateCode && reveal.guessState === place.stateCode,
    };
    usedScenes.current.push(prepared.scene.id);
    const all = [...records, record];
    if (index + 1 >= ROUNDS_PER_GAME) {
      if (queue) pushRecentAnchors(queue.anchorIds);
      pushRecentScenes(usedScenes.current);
      onComplete({ settings, area, providerId: provider.id, rounds: all, total: all.reduce((s, r) => s + r.points, 0) });
      return;
    }
    setRecords(all);
    setReveal(null);
    setGuess(null);
    setPrepared(null);
    setHeading(null);
    setIndex((i) => i + 1);
  }, [phase, reveal, prepared, index, guess, records, queue, onComplete, settings, area, provider.id]);

  // Round timer: auto-submit with the current pin (or 0 points if none).
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (phase !== 'playing' || !settings.timer) return;
    const id = window.setInterval(() => {
      const left = settings.timer - (performance.now() - startedAt.current) / 1000;
      setTimeLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(id);
        submitRef.current(true);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, settings.timer]);

  // Keyboard shortcuts.
  const keyState = useRef({ phase, guess, submit, next });
  keyState.current = { phase, guess, submit, next };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const s = keyState.current;
      const key = e.key;
      if (key === ' ' || key === 'Spacebar' || key === 'Enter') {
        if (s.phase === 'playing' && key !== 'Enter' && s.guess) {
          e.preventDefault();
          s.submit();
        } else if (s.phase === 'reveal') {
          e.preventDefault();
          s.next();
        } else if (key === ' ') {
          e.preventDefault();
        }
        return;
      }
      if (s.phase !== 'playing') return;
      if (key === 'm' || key === 'M') {
        setPinned((p) => !p);
        setSheetOpen((o) => !o);
      } else if (key === 'Escape') {
        setPinned(false);
        setHovered(false);
        setSheetOpen(false);
      } else if (key === 'r' || key === 'R') {
        viewerRef.current?.resetView();
        if (prepared) setViewScene(prepared.scene);
      } else if (key === '+' || key === '=') {
        viewerRef.current?.zoomIn();
      } else if (key === '-' || key === '_') {
        viewerRef.current?.zoomOut();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prepared]);

  /** If imagery fails after locating, swap in a verified pool image instead of stalling. */
  const onViewerError = useCallback(() => {
    if (!prepared || recovered.current) return;
    recovered.current = true;
    const previous = records.map((r) => r.actual);
    const fallback = pickFromFallbackPool(area.pack, {
      previous,
      excludeIds: new Set([...usedScenes.current, prepared.scene.id]),
      minSeparationKm: area.minSeparationKm,
      prefer: area.contains,
    });
    const round: PreparedRound = { ...prepared, scene: fallback, candidate: null, verdict: null, usedFallback: true, place: resolvePlace(fallback, null, null) };
    setPrepared(round);
    setViewScene(fallback);
  }, [prepared, records, area]);

  const onHeading = useCallback((h: number | null) => setHeading(h), []);
  const onReady = useCallback(() => undefined, []);

  return (
    <main className="game" aria-label="Game">
      {viewScene && phase !== 'locating' && (
        <SceneViewer
          key={viewScene.id}
          ref={viewerRef}
          scene={viewScene}
          ruleset={settings.ruleset}
          onHeading={onHeading}
          onReady={onReady}
          onError={onViewerError}
        />
      )}

      <Hud regionLabel={area.label} round={index} score={totalScore} timeLeft={phase === 'playing' ? timeLeft : null} timeTotal={settings.timer} onExit={onExit} />

      {phase === 'playing' && scene && (
        <>
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
            {settings.ruleset !== 'nmpz' && (
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
            className={`guess${expanded ? ' guess--expanded' : ''}${sheetOpen ? ' guess--sheet-open' : ''}${guess ? ' guess--has-pin' : ''}`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="guess__tools">
              <button className="guess__tool" onClick={() => setPinned((p) => !p)} aria-pressed={pinned} title={pinned ? 'Unpin map size (M)' : 'Keep the map large (M)'}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  {pinned ? (
                    <path d="M6 2v4H2M10 14v-4h4M6 6 2 2M10 10l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  ) : (
                    <path d="M2 6V2h4M14 10v4h-4M2 2l4.5 4.5M14 14l-4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
                <span>{pinned ? 'Shrink' : 'Enlarge'}</span>
                <kbd>M</kbd>
              </button>
            </div>
            <div className="guess__map">
              <GuessMap area={area} guess={guess} onGuess={setGuess} sizeToken={`${expanded}-${sheetOpen}`} compact={!expanded && !sheetOpen} />
            </div>
            <div className="guess__buttons">
              <Button variant="secondary" size="lg" className="guess__sheet-toggle" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
                {sheetOpen ? 'Hide map' : 'Map'}
              </Button>
              <Button size="lg" block disabled={!guess} onClick={() => submit()} className="guess__go">
                {guess ? 'Guess' : 'Place your pin on the map'}
              </Button>
            </div>
          </div>
        </>
      )}

      {phase === 'locating' && <LocatingOverlay round={index} areaLabel={area.label} />}

      {phase === 'reveal' && prepared && reveal && (
        <RoundReveal
          area={area}
          round={index}
          scene={prepared.scene}
          guess={guess}
          distanceKm={reveal.distanceKm}
          points={reveal.points}
          place={reveal.place}
          archetype={prepared.usedFallback ? null : prepared.archetype}
          guessState={reveal.guessState}
          timedOut={reveal.timedOut}
          onNext={next}
        />
      )}
    </main>
  );
}
