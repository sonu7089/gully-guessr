import { useEffect, useMemo, useState } from 'react';
import { GAME_TITLE, MAX_GAME_SCORE } from '../config';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { SummaryMap, type Vector } from '../components/Maps';
import { ArrowButton } from '../components/ui';
import { formatClock } from '../components/Hud';
import type { ProviderId } from '../engine/imageryProviders';
import { REGION_PACKS } from '../engine/locationGenerator';
import { formatDistance, formatScore, rankForScore } from '../utils/scoring';
import type { CompletedGame } from './GamePage';

const RULESET_LABEL = { standard: 'Standard', nomove: 'No Move', nmpz: 'NMPZ' } as const;
const pad2 = (n: number) => String(n).padStart(2, '0');

export function buildScoreCard(game: CompletedGame): string {
  const pack = REGION_PACKS.find((p) => p.id === game.settings.pack)?.short ?? 'All India';
  const lines = game.rounds.map((r, i) => {
    const filled = Math.round((r.points / 5000) * 5);
    const bar = '▰'.repeat(filled) + '▱'.repeat(5 - filled);
    return `${pad2(i + 1)} ${bar} ${formatScore(r.points).padStart(5)} pts · ${formatDistance(r.distanceKm)} · ${r.stateName}`;
  });
  return [
    `${GAME_TITLE} · ${pack} · ${RULESET_LABEL[game.settings.ruleset]}${game.settings.timer ? ` · ${game.settings.timer}s` : ''}`,
    `${formatScore(game.total)} / ${formatScore(MAX_GAME_SCORE)} — ${rankForScore(game.total)}`,
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
  const pack = REGION_PACKS.find((p) => p.id === game.settings.pack)?.short ?? 'All India';
  const vectors: Vector[] = useMemo(
    () => game.rounds.map((r, i) => ({ actual: r.actual, guess: r.guess, label: pad2(i + 1) })),
    [game.rounds],
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  const copy = async () => {
    const text = buildScoreCard(game);
    try {
      await navigator.clipboard.writeText(text);
      setToast('Score card copied');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      setToast(ok ? 'Score card copied' : 'Copy failed — select and copy manually');
    }
    window.setTimeout(() => setToast(''), 2500);
  };

  return (
    <>
      <Header onPlayNow={onPlayAgain} onHome={onHome} />
      <main>
        <section className="band-dark summary-hero" aria-labelledby="summary-title">
          <div className="container summary-hero__grid">
            <div>
              <p className="eyebrow">
                Match complete · {pack} · {RULESET_LABEL[game.settings.ruleset]}
              </p>
              <h1 id="summary-title" className="summary-total">
                {formatScore(game.total)} <small>/ {formatScore(MAX_GAME_SCORE)}</small>
              </h1>
            </div>
            <div className="summary-rank">
              <span className="eyebrow">Rank</span>
              <p className="summary-rank__title">{rankForScore(game.total)}</p>
              {isNewBest && <span className="badge badge--lilac">New personal best</span>}
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 'clamp(40px, 5vw, 72px)' }}>
          <div className="container">
            <div className="summary-map">
              <SummaryMap vectors={vectors} selected={selected} onSelect={(i) => setSelected((s) => (s === i ? null : i))} />
            </div>

            <table className="rounds-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Location</th>
                  <th scope="col">State / UT</th>
                  <th scope="col">Distance</th>
                  <th scope="col" className="hide-sm">
                    Time
                  </th>
                  <th scope="col" className="pts">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {game.rounds.map((r, i) => (
                  <tr
                    key={i}
                    aria-selected={selected === i}
                    tabIndex={0}
                    onClick={() => setSelected((s) => (s === i ? null : i))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected((s) => (s === i ? null : i));
                      }
                    }}
                  >
                    <td className="num">{pad2(i + 1)}</td>
                    <td>{r.locality}</td>
                    <td>
                      {r.stateName}
                      {r.correctState && <span className="badge" style={{ marginLeft: 8, padding: '2px 6px' }}>✓ state</span>}
                    </td>
                    <td>{formatDistance(r.distanceKm)}</td>
                    <td className="hide-sm">{formatClock(r.timeTakenSec)}</td>
                    <td className="pts">{formatScore(r.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="action-bar">
              <ArrowButton variant="ink" onClick={onPlayAgain}>
                Play again
              </ArrowButton>
              <ArrowButton variant="outline" arrow="↗" onClick={onChangeMode}>
                Change mode / region
              </ArrowButton>
              <ArrowButton variant="outline" arrow="↓" onClick={copy}>
                Copy score card
              </ArrowButton>
              <span className="toast" role="status" aria-live="polite">
                {toast}
              </span>
            </div>
          </div>
        </section>
      </main>
      <Footer provider={provider} />
    </>
  );
}
