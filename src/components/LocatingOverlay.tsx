import { ROUNDS_PER_GAME } from '../config';

export function LocatingOverlay({ round, providerLabel }: { round: number; providerLabel: string }) {
  return (
    <div className="locating" role="status" aria-live="polite">
      <div className="locating__inner">
        <p className="eyebrow">
          Round {String(round + 1).padStart(2, '0')} / {String(ROUNDS_PER_GAME).padStart(2, '0')}
        </p>
        <h2 className="locating__title">Locating next spot…</h2>
        <div className="locating__bar" aria-hidden="true" />
        <p className="body-copy muted" style={{ fontSize: 14 }}>
          Sampling a fresh coordinate, snapping it to {providerLabel} imagery and checking it is identifiable.
        </p>
      </div>
    </div>
  );
}
