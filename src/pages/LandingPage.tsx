import { useState } from 'react';
import { GAME_TITLE, ROUNDS_PER_GAME } from '../config';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { ProviderChip, ProviderNote } from '../components/ProviderChip';
import { ArrowButton } from '../components/ui';
import { formatCoord } from '../engine/geo';
import type { ProviderId } from '../engine/imageryProviders';
import { REGION_PACKS } from '../engine/locationGenerator';
import type { GameSettings, Ruleset, TimerOption } from '../engine/types';
import { formatDistance, formatScore } from '../utils/scoring';
import { averageDistanceKm, type LocalStats, type MatchRecord } from '../utils/storage';

const HERO_COORD = { lat: 26.924, lng: 75.8273 };

const RULESETS: { id: Ruleset; label: string; note: string }[] = [
  { id: 'standard', label: 'Standard', note: 'Pan, zoom and move along the road where the imagery provider supports it.' },
  { id: 'nomove', label: 'No Move', note: 'Pan and zoom from a fixed spot.' },
  { id: 'nmpz', label: 'NMPZ', note: 'No move, pan or zoom — one static frame.' },
];

const TIMERS: { id: TimerOption; label: string }[] = [
  { id: 0, label: 'Untimed' },
  { id: 60, label: '60s' },
  { id: 90, label: '90s' },
  { id: 120, label: '120s' },
];

const STEPS = [
  { title: 'Drop into a random Indian street', body: 'Every round is generated fresh: a weighted mix of towns, highways, villages, coasts and the odd forest road across all 28 States and 8 UTs.' },
  { title: 'Pin your guess on the map', body: 'Read the scripts on shopfronts, the soil, the buses and the architecture, then drop a pin on the India map and lock it in.' },
  { title: 'Read the regional clues & chase 25,000', body: 'See how far off you were, learn the script, RTO plate prefix and landscape tells for that state, and go again.' },
];

interface LandingPageProps {
  settings: GameSettings;
  onSettingsChange: (s: GameSettings) => void;
  onStart: (s: GameSettings) => void;
  onQuickPlay: () => void;
  stats: LocalStats;
  matches: MatchRecord[];
  onResetStats: () => void;
  provider: ProviderId;
}

function Radio<T extends string | number>({ name, value, options, onChange }: { name: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="mode-row__options" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={o.id === value} className="chip" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LandingPage({ settings, onSettingsChange, onStart, onQuickPlay, stats, matches, onResetStats, provider }: LandingPageProps) {
  const [confirmReset, setConfirmReset] = useState(false);
  const avg = averageDistanceKm(stats);
  const ruleNote = RULESETS.find((r) => r.id === settings.ruleset)?.note;
  const packLabel = REGION_PACKS.find((p) => p.id === settings.pack)?.short;
  const update = (patch: Partial<GameSettings>) => onSettingsChange({ ...settings, ...patch });

  return (
    <>
      <Header onPlayNow={onQuickPlay} onHome={() => window.scrollTo({ top: 0 })} />
      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">Single-player India street exploration</p>
              <h1 id="hero-title" className="h1">
                Pin
                <br />
                India.
              </h1>
              <p className="body-copy">
                Five procedurally generated rounds drop you onto real streets, highways and villages anywhere from Leh to Kanyakumari. Read the
                clues, pin your guess and score up to {formatScore(ROUNDS_PER_GAME * 5000)}.
              </p>
              <div className="hero__cta">
                <ArrowButton variant="ink" onClick={() => onStart(settings)}>
                  Start {ROUNDS_PER_GAME}-round game
                </ArrowButton>
                {stats.bestScore > 0 && (
                  <span className="hero__pb">
                    Personal best <strong>{formatScore(stats.bestScore)}</strong>
                  </span>
                )}
              </div>
            </div>
            <figure className="hero__figure">
              <img className="chamfer" src="/hero-jaipur.jpg" alt="Pink sandstone façade of Hawa Mahal above a Jaipur bazaar street" width={1280} height={853} />
              <figcaption className="hero__meta">
                <span className="eyebrow">{formatCoord(HERO_COORD)}</span>
                <span className="eyebrow">Jaipur, Rajasthan</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="how" className="section" aria-labelledby="how-title">
          <div className="container">
            <div className="section-head">
              <h2 id="how-title" className="h2">
                How it
                <br />
                works
              </h2>
              <p className="body-copy muted">
                No login, no accounts — {GAME_TITLE} runs entirely in your browser. Your personal bests and recent matches stay on this device.
              </p>
            </div>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="step">
                  <div className="step-index" aria-hidden="true">
                    <span className="step-index__num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="step-index__rule" />
                  </div>
                  <h3 className="h3">{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="regions" className="band-dark" aria-labelledby="regions-title">
          <div className="container mode__grid">
            <div className="mode__intro">
              <p className="eyebrow">Choose your route</p>
              <h2 id="regions-title" className="h2">
                Every corner
                <br />
                of India.
              </h2>
              <p className="body-copy">
                Pick a region pack, a ruleset and a round timer. Rounds stay at least 35 km apart and forest roads appear only as a rare wildcard
                (about 1.5% of rounds).
              </p>
              <ArrowButton variant="lilac" onClick={() => onStart(settings)}>
                Launch selected mode
              </ArrowButton>
              <ProviderChip provider={provider} />
              <ProviderNote provider={provider} />
            </div>
            <div className="mode__rows">
              <fieldset className="mode-row">
                <legend className="eyebrow">Region pack</legend>
                <Radio name="Region pack" value={settings.pack} options={REGION_PACKS.map((p) => ({ id: p.id, label: p.label }))} onChange={(pack) => update({ pack })} />
              </fieldset>
              <fieldset className="mode-row">
                <legend className="eyebrow">Ruleset</legend>
                <Radio name="Ruleset" value={settings.ruleset} options={RULESETS} onChange={(ruleset) => update({ ruleset })} />
                <p className="mode-row__note">{ruleNote}</p>
              </fieldset>
              <fieldset className="mode-row">
                <legend className="eyebrow">Round timer</legend>
                <Radio name="Round timer" value={settings.timer} options={TIMERS} onChange={(timer) => update({ timer })} />
              </fieldset>
              <div className="mode-row" style={{ border: 0 }}>
                <span className="eyebrow" style={{ color: 'var(--dark-muted)' }}>
                  Selected
                </span>
                <span style={{ fontWeight: 700 }}>
                  {packLabel} · {RULESETS.find((r) => r.id === settings.ruleset)?.label} · {TIMERS.find((t) => t.id === settings.timer)?.label}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="stats" className="section" aria-labelledby="stats-title">
          <div className="container">
            <div className="section-head">
              <h2 id="stats-title" className="h2">
                Local
                <br />
                stats
              </h2>
              <p className="body-copy muted">Stored only in this browser’s localStorage. Nothing leaves your device.</p>
            </div>
            <div className="stats">
              <div className="stat">
                <span className="eyebrow muted">Best score</span>
                <span className="stat__value">{stats.bestScore ? formatScore(stats.bestScore) : '—'}</span>
                <span className="stat__sub">of {formatScore(ROUNDS_PER_GAME * 5000)}</span>
              </div>
              <div className="stat">
                <span className="eyebrow muted">Games completed</span>
                <span className="stat__value">{stats.gamesCompleted}</span>
                <span className="stat__sub">{stats.gamesCompleted === 1 ? 'match' : 'matches'}</span>
              </div>
              <div className="stat">
                <span className="eyebrow muted">Average distance</span>
                <span className="stat__value">{avg != null ? formatDistance(avg) : '—'}</span>
                <span className="stat__sub">per guessed round</span>
              </div>
              <div className="stat">
                <span className="eyebrow muted">Best single round</span>
                <span className="stat__value">{stats.bestRound ? formatScore(stats.bestRound.points) : '—'}</span>
                <span className="stat__sub">{stats.bestRound ? `${stats.bestRound.locality}, ${stats.bestRound.stateName}` : 'pts'}</span>
              </div>
            </div>
            {matches.length > 0 && (
              <ol className="recent" aria-label="Recent matches">
                {matches.slice(0, 5).map((m) => (
                  <li key={m.id}>
                    <span className="eyebrow muted">{new Date(m.playedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    <span>
                      {REGION_PACKS.find((p) => p.id === m.settings.pack)?.short} · {m.rounds.map((r) => r.stateName).join(' → ')}
                    </span>
                    <span className="recent__score">{formatScore(m.total)}</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="stats__foot">
              <span className="eyebrow muted">Saved locally · no account needed</span>
              {confirmReset ? (
                <span style={{ display: 'inline-flex', gap: 16 }}>
                  <button
                    className="link-quiet"
                    onClick={() => {
                      onResetStats();
                      setConfirmReset(false);
                    }}
                  >
                    Yes, reset everything
                  </button>
                  <button className="link-quiet" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="link-quiet" onClick={() => setConfirmReset(true)} disabled={stats.gamesCompleted === 0 && matches.length === 0}>
                  Reset local stats
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer provider={provider} />
    </>
  );
}
