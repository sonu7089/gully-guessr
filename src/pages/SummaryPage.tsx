import { useEffect, useMemo, useState } from 'react';
import { GAME_TITLE, MAX_GAME_SCORE, MAX_ROUND_SCORE } from '../config';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { formatClock } from '../components/Hud';
import { SummaryMap, type Vector } from '../components/Maps';
import { Button, Eyebrow, PlayIcon, ProgressBar, useCountUp } from '../components/ui';
import type { ProviderId } from '../engine/imageryProviders';
import { RULESET_INFO } from '../utils/labels';
import { formatDistance, formatScore } from '../utils/scoring';
import type { CompletedGame } from './GamePage';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function buildScoreCard(game: CompletedGame): string {
  const lines = game.rounds.map((r, i) => {
    const filled = Math.round((r.points / MAX_ROUND_SCORE) * 5);
    const bar = '▰'.repeat(filled) + '▱'.repeat(5 - filled);
    return `${pad2(i + 1)} ${bar} ${formatScore(r.points).padStart(5)} pts · ${formatDistance(r.distanceKm)} · ${r.locality}`;
  });
  return [
    `${GAME_TITLE} · ${game.area.label} · ${RULESET_INFO[game.settings.ruleset].label}${game.settings.timer ? ` · ${game.settings.timer}s` : ''}`,
    `${formatScore(game.total)} / ${formatScore(MAX_GAME_SCORE)} points`,
    ...lines,
  ].join('\n');
}

interface SummaryPageProps {
  game: CompletedGame;
  isNewBest: boolean;
  provider: ProviderId;
  onPlayAgain: () => void;
  onChangeMode: () => void;
  onHome: () => void;
}

export function SummaryPage({ game, isNewBest, provider, onPlayAgain, onChangeMode, onHome }: SummaryPageProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const shown = useCountUp(game.total, 1400, 0);
  const vectors: Vector[] = useMemo(() => game.rounds.map((r, i) => ({ actual: r.actual, guess: r.guess, label: pad2(i + 1) })), [game.rounds]);
  const best = game.rounds.reduce((b, r, i) => (r.points > game.rounds[b].points ? i : b), 0);
  const pinned = game.rounds.filter((r) => r.distanceKm != null);
  const avgKm = pinned.length ? pinned.reduce((s, r) => s + r.distanceKm!, 0) / pinned.length : null;
  const totalTime = game.rounds.reduce((s, r) => s + r.timeTakenSec, 0);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const copy = async () => {
    const text = buildScoreCard(game);
    try {
      await navigator.clipboard.writeText(text);
      setToast('Copied to clipboard');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      setToast(ok ? 'Copied to clipboard' : 'Copy failed');
    }
    window.setTimeout(() => setToast(''), 2500);
  };

  const select = (i: number) => setSelected((s) => (s === i ? null : i));

  return (
    <>
      <Header onPlayNow={onPlayAgain} onHome={onHome} />
      <div className="stars" aria-hidden="true" />
      <main className="container summary">
        <section className="panel final" aria-labelledby="summary-title">
          <div className="final__total">
            <Eyebrow>
              Game finished · {game.area.label} · {RULESET_INFO[game.settings.ruleset].label}
            </Eyebrow>
            <h1 id="summary-title" className="final__points" aria-label={`${formatScore(game.total)} of ${formatScore(MAX_GAME_SCORE)} points`}>
              <span aria-hidden="true">{formatScore(shown)}</span> <small>/ {formatScore(MAX_GAME_SCORE)} points</small>
            </h1>
            <ProgressBar value={game.total / MAX_GAME_SCORE} label="Game score" />
            {isNewBest && <span className="badge-best">New personal best</span>}
          </div>
          <dl className="stat-row final__stats">
            <div>
              <dd>{Math.round((game.total / MAX_GAME_SCORE) * 100)}%</dd>
              <dt>Accuracy</dt>
            </div>
            <div>
              <dd>{avgKm != null ? formatDistance(avgKm) : '—'}</dd>
              <dt>Average distance</dt>
            </div>
            <div>
              <dd>{formatScore(game.rounds[best].points)}</dd>
              <dt>Best round</dt>
            </div>
            <div>
              <dd>{formatClock(totalTime)}</dd>
              <dt>Total time</dt>
            </div>
          </dl>
        </section>

        <div className="summary__map">
          <SummaryMap area={game.area} vectors={vectors} selected={selected} onSelect={select} />
        </div>

        <ol className="rounds" aria-label="Rounds">
          {game.rounds.map((r, i) => (
            <li key={i}>
              <button type="button" className="round-card" aria-pressed={selected === i} onClick={() => select(i)}>
                <span className="round-card__head">
                  <Eyebrow>Round {i + 1}</Eyebrow>
                  {i === best && r.points > 0 && <span className="round-card__best">Best</span>}
                </span>
                <span className="round-card__pts">
                  {formatScore(r.points)} <small>pts</small>
                </span>
                <ProgressBar size="sm" value={r.points / MAX_ROUND_SCORE} label={`Round ${i + 1} score`} />
                <strong className="round-card__place">{r.locality}</strong>
                <span className="round-card__meta">
                  {r.stateName}
                  {r.correctState && ' · correct state'}
                </span>
                <span className="round-card__meta">
                  {r.distanceKm != null ? `${formatDistance(r.distanceKm)} away` : 'No guess'} · {formatClock(r.timeTakenSec)}
                </span>
              </button>
            </li>
          ))}
        </ol>

        <div className="summary__actions">
          <Button size="lg" onClick={onPlayAgain} icon={<PlayIcon />}>
            Play again
          </Button>
          <Button variant="secondary" size="lg" onClick={onChangeMode}>
            Change map
          </Button>
          <Button variant="ghost" size="lg" onClick={copy}>
            Copy results
          </Button>
          <span className="toast" role="status" aria-live="polite">
            {toast}
          </span>
        </div>
      </main>
      <Footer provider={provider} />
    </>
  );
}
