import type { ReactNode } from 'react';
import { ROUNDS_PER_GAME } from '../config';

interface LocatingOverlayProps {
  round: number;
  areaLabel: string;
  line?: string;
  children?: ReactNode;
}

export function LocatingOverlay({ round, areaLabel, line = 'Finding a location…', children }: LocatingOverlayProps) {
  return (
    <div className="locating" role="status" aria-live="polite">
      <div className="stars" aria-hidden="true" />
      <div className="locating__inner">
        <span className="locating__spinner" aria-hidden="true" />
        <span className="eyebrow">{areaLabel}</span>
        <h2 className="locating__title">
          Round {round + 1}
          <small> / {ROUNDS_PER_GAME}</small>
        </h2>
        <p className="locating__line">{line}</p>
        {children}
      </div>
    </div>
  );
}
