import { MAX_ROUND_SCORE, ROUNDS_PER_GAME } from '../config';
import { INDIA_STATES } from '../data/indiaStateClues';
import type { Scene } from '../engine/imageryProviders';
import { ARCHETYPE_LABELS } from '../engine/locationGenerator';
import type { RevealedPlace } from '../engine/roundPlanner';
import type { Archetype, LatLng, StateCode } from '../engine/types';
import { formatDistance, formatScore } from '../utils/scoring';
import { ResultMap } from './Maps';
import { ArrowButton } from './ui';

interface RoundRevealProps {
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

export function RoundReveal({ round, scene, guess, distanceKm, points, place, archetype, guessState, timedOut, onNext }: RoundRevealProps) {
  const last = round + 1 >= ROUNDS_PER_GAME;
  const state = place?.stateCode ? INDIA_STATES[place.stateCode] : null;
  const correctState = !!place?.stateCode && guessState === place.stateCode;
  const pct = Math.round((points / MAX_ROUND_SCORE) * 100);
  const where = [place?.district && place.district !== place.locality ? place.district : null, place?.stateName].filter(Boolean).join(', ');

  return (
    <section className="reveal" aria-labelledby="reveal-title">
      <div className="reveal__map">
        <ResultMap actual={scene} guess={guess} />
      </div>

      <div className="reveal__panel">
        <div className="reveal__col">
          <p className="eyebrow muted">
            Round {String(round + 1).padStart(2, '0')} / {String(ROUNDS_PER_GAME).padStart(2, '0')} · Result
          </p>
          <h2 id="reveal-title" className="reveal__score">
            {formatScore(points)} <small>/ {formatScore(MAX_ROUND_SCORE)} pts</small>
          </h2>
          <p className="reveal__distance">
            {distanceKm == null ? (timedOut ? 'Time’s up — no pin placed' : 'No guess') : `${formatDistance(distanceKm)} away`}
          </p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Round score">
            <div className="progress__fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="reveal__col">
          <p className="eyebrow muted">The spot</p>
          {place ? (
            <>
              <h3 className="place-name">{place.locality}</h3>
              <p className="body-copy" style={{ marginTop: -6 }}>
                {where}
              </p>
            </>
          ) : (
            <h3 className="place-name muted">Resolving location…</h3>
          )}
          <div className="badge-row">
            <span className="badge">{archetype ? ARCHETYPE_LABELS[archetype] : 'Curated spot'}</span>
            {state && <span className="badge">{state.kind === 'ut' ? 'Union Territory' : 'State'}</span>}
            {correctState && <span className="badge badge--solid">Correct state</span>}
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
                    Source ↗
                  </a>
                </>
              )}
            </p>
          )}
        </div>

        <div className="reveal__col">
          <p className="eyebrow muted">Regional clues{state ? ` · ${state.name}` : ''}</p>
          {state ? (
            <ul className="clues">
              <li>
                <span className="eyebrow">Script</span>
                <span>{state.scripts.join(', ')}</span>
              </li>
              <li>
                <span className="eyebrow">Number plate</span>
                <span>
                  RTO prefix <strong>{state.rto}</strong>
                </span>
              </li>
              {place?.road && (
                <li>
                  <span className="eyebrow">Road</span>
                  <span>{place.road}</span>
                </li>
              )}
              <li>
                <span className="eyebrow">Landscape</span>
                <span>{state.landscape}</span>
              </li>
              <li>
                <span className="eyebrow">Look for</span>
                <span>{state.hint}</span>
              </li>
            </ul>
          ) : (
            <p className="body-copy muted">{place ? 'No state clues available for this point.' : 'Loading clues…'}</p>
          )}
        </div>
      </div>

      <div className="reveal__actions">
        <span className="eyebrow muted">
          <kbd>Space</kbd>
          <kbd>Enter</kbd> to continue
        </span>
        <ArrowButton variant="ink" onClick={onNext} disabled={!place} autoFocus>
          {place ? (last ? 'View final summary' : 'Next round') : 'Resolving…'}
        </ArrowButton>
      </div>
    </section>
  );
}
