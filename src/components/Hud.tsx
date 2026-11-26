import { ROUNDS_PER_GAME } from '../config';
import { formatScore } from '../utils/scoring';
import { useCountUp } from './ui';

interface HudProps {
  regionLabel: string;
  round: number;
  score: number;
  timeLeft: number | null;
  timeTotal: number;
  onExit: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

export function Hud({ regionLabel, round, score, timeLeft, timeTotal, onExit }: HudProps) {
  const shown = useCountUp(score, 900);
  const low = timeLeft != null && timeLeft <= 10;
  return (
    <>
      <button className="hud-exit" onClick={onExit} aria-label="Leave game" title="Leave game">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {timeLeft != null && timeTotal > 0 && (
        <div className={`hud-timer${low ? ' hud-timer--low' : ''}`} role="timer" aria-label={`${Math.ceil(timeLeft)} seconds left`}>
          <span className="hud-timer__clock">{formatClock(timeLeft)}</span>
          <span className="hud-timer__track" aria-hidden="true">
            <span className="hud-timer__fill" style={{ width: `${(timeLeft / timeTotal) * 100}%` }} />
          </span>
        </div>
      )}

      <div className="status" role="status" aria-live="off">
        <div className="status__item status__item--map">
          <span className="status__label">Map</span>
          <span className="status__value">{regionLabel}</span>
        </div>
        <div className="status__item">
          <span className="status__label">Round</span>
          <span className="status__value">
            {round + 1} / {ROUNDS_PER_GAME}
          </span>
        </div>
        <div className="status__item">
          <span className="status__label">Score</span>
          <span className="status__value">{formatScore(shown)}</span>
        </div>
      </div>
    </>
  );
}
