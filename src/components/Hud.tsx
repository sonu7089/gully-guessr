import { ROUNDS_PER_GAME } from '../config';
import { formatPoints } from '../utils/scoring';

interface HudProps {
  regionLabel: string;
  round: number;
  score: number;
  timeLeft: number | null;
  onExit: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
}

export function Hud({ regionLabel, round, score, timeLeft, onExit }: HudProps) {
  return (
    <div className="hud">
      <div className="hud__bar" role="status" aria-live="off">
        <button className="hud__exit" onClick={onExit}>
          ← Exit
        </button>
        <div className="hud__cell hud__region">
          <span className="eyebrow">{regionLabel}</span>
        </div>
        <div className="hud__cell">
          <span className="eyebrow">Round</span>
          <span className="hud__num">
            {pad2(round + 1)} / {pad2(ROUNDS_PER_GAME)}
          </span>
        </div>
        <div className="hud__cell">
          <span className="eyebrow">Score</span>
          <span className="hud__num">{formatPoints(score)}</span>
        </div>
        {timeLeft != null && (
          <div className={`hud__cell${timeLeft <= 10 ? ' hud__timer--low' : ''}`}>
            <span className="eyebrow">Time</span>
            <span className="hud__num" aria-label={`${Math.ceil(timeLeft)} seconds left`}>
              {formatClock(timeLeft)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
