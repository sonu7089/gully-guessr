import { useState } from 'react';
import { MAX_ROUND_SCORE, ROUNDS_PER_GAME } from '../config';
import { INDIA_STATES } from '../data/indiaStateClues';
import type { Scene } from '../engine/imageryProviders';
import { ARCHETYPE_LABELS } from '../engine/locationGenerator';
import type { PlayArea } from '../engine/playArea';
import type { RevealedPlace } from '../engine/roundPlanner';
import type { Archetype, LatLng, StateCode } from '../engine/types';
import { formatDistance, formatScore } from '../utils/scoring';
import { IndiaLocator } from './IndiaLocator';
import { ResultMap, type ResultView } from './Maps';
import { Button, ChevronIcon, Eyebrow, ProgressBar, Segmented, useCountUp } from './ui';

interface RoundRevealProps {
  area: PlayArea;
  round: number;
  scene: Scene;
  guess: LatLng | null;
  distanceKm: number | null;
  points: number;
  place: RevealedPlace | null;
  archetype: Archetype | null;
  guessState: StateCode | null | undefined;
  timedOut: boolean;
  onNext: () => void;
}

const VIEWS: { id: ResultView; label: string }[] = [
  { id: 'both', label: 'Both pins' },
  { id: 'spot', label: 'Location' },
  { id: 'area', label: 'Whole map' },
];

export function RoundReveal({ area, round, scene, guess, distanceKm, points, place, archetype, guessState, timedOut, onNext }: RoundRevealProps) {
  const [view, setView] = useState<ResultView>('both');
  const last = round + 1 >= ROUNDS_PER_GAME;
  const shown = useCountUp(points, 1100, 0);
  const state = place?.stateCode ? INDIA_STATES[place.stateCode] : null;
  const correctState = !!place?.stateCode && guessState === place.stateCode;
  const where = [place?.district && place.district !== place.locality ? place.district : null, place?.stateName].filter(Boolean).join(', ');
  const distanceLabel = distanceKm != null ? formatDistance(distanceKm) : null;

  return (
    <section className="result" aria-labelledby="result-title">
      <div className="result__map">
        <ResultMap area={area} actual={scene} guess={guess} view={view} distanceLabel={distanceLabel} />
        <Segmented className="result__views" name="Map view" value={view} options={VIEWS} onChange={setView} />
        <figure className="result__locator">
          <IndiaLocator actual={scene} guess={area.scope === 'india' ? guess : null} stateCode={place?.stateCode ?? area.stateCode} />
        </figure>
      </div>

      {state && (
        <details className="clues">
          <summary>
            <Eyebrow>Clues for {state.name}</Eyebrow>
            <ChevronIcon />
          </summary>
          <dl>
            <div>
              <dt>Script</dt>
              <dd>{state.scripts.join(', ')}</dd>
            </div>
            <div>
              <dt>Number plates</dt>
              <dd>
                Start with <strong>{state.rto}</strong>
              </dd>
            </div>
            {place?.road && (
              <div>
                <dt>Road</dt>
                <dd>{place.road}</dd>
              </div>
            )}
            <div>
              <dt>Landscape</dt>
              <dd>{state.landscape}</dd>
            </div>
            <div>
              <dt>Look for</dt>
              <dd>{state.hint}</dd>
            </div>
          </dl>
        </details>
      )}

      <div className="result__bar">
        <div className="result__inner">
          <div className="result__place">
            <Eyebrow>
              <span className="legend-dot legend-dot--actual" aria-hidden="true" /> Correct location
            </Eyebrow>
            <h3 className="result__locality">{place?.locality ?? 'Looking up the name…'}</h3>
            {where && <p className="result__where">{where}</p>}
            <ul className="tags tags--muted">
              <li>{archetype ? ARCHETYPE_LABELS[archetype] : 'Curated spot'}</li>
              {state?.kind === 'ut' && <li>Union territory</li>}
              {correctState && <li className="tag--good">Correct state</li>}
            </ul>
          </div>

          <div className="result__score">
            <Eyebrow>
              Round {round + 1} / {ROUNDS_PER_GAME}
            </Eyebrow>
            <h2 id="result-title" className="result__points" aria-label={`${formatScore(points)} points`}>
              <span aria-hidden="true">{formatScore(shown)}</span> <small>points</small>
            </h2>
            <ProgressBar value={points / MAX_ROUND_SCORE} label="Round score" />
            <p className="result__distance">
              {distanceLabel ? (
                <>
                  <span className="legend-dot legend-dot--guess" aria-hidden="true" /> Your guess was <strong>{distanceLabel}</strong> from the correct location
                </>
              ) : timedOut ? (
                'Time ran out before you placed a pin'
              ) : (
                'No pin was placed this round'
              )}
            </p>
          </div>

          <div className="result__actions">
            <Button size="lg" block onClick={onNext} disabled={!place} autoFocus>
              {place ? (last ? 'View results' : 'Next round') : 'Loading…'}
            </Button>
            <span className="result__hint">
              Press <kbd>Space</kbd>
            </span>
          </div>
        </div>

        {scene.attribution && (
          <p className="attribution">
            {scene.attribution.source}
            {scene.attribution.author ? ` · ${scene.attribution.author}` : ''}
            {scene.attribution.license ? ` · ${scene.attribution.license}` : ''}
            {scene.attribution.url && (
              <>
                {' · '}
                <a href={scene.attribution.url} target="_blank" rel="noreferrer">
                  Source
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}
