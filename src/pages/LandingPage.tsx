import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { ROUNDS_PER_GAME } from '../config';
import { useMultiplayer } from '../multiplayer/MultiplayerProvider';
import { Footer } from '../components/Footer';
import { Header } from '../components/Header';
import { IndiaLocator } from '../components/IndiaLocator';
import { ProviderNote } from '../components/ProviderChip';
import { Button, CheckIcon, Eyebrow, PlayIcon, Segmented, SelectPill } from '../components/ui';
import { CITY_BY_ID, INDIA_CITIES } from '../data/indiaCities';
import { INDIA_STATES } from '../data/indiaStateClues';
import { PROVIDER_LABELS, type ProviderId } from '../engine/imageryProviders';
import { REGION_PACKS } from '../engine/locationGenerator';
import { PLAYABLE_STATES, playAreaLabel, resolvePlayArea } from '../engine/playArea';
import type { GameScope, GameSettings, LatLng, RegionPack, Ruleset, StateCode, TimerOption } from '../engine/types';
import { RULESET_INFO, SCOPE_INFO, TIMER_INFO } from '../utils/labels';
import { formatDistance, formatScore } from '../utils/scoring';
import { averageDistanceKm, type LocalStats, type MatchRecord } from '../utils/storage';

const MAX_TOTAL = ROUNDS_PER_GAME * 5000;

const RULESETS = (Object.keys(RULESET_INFO) as Ruleset[]).map((id) => ({ id, label: RULESET_INFO[id].label }));
const TIMERS = ([0, 60, 90, 120] as TimerOption[]).map((id) => ({ id, label: TIMER_INFO[id] }));
const TABS: { id: GameScope; label: string }[] = [
  { id: 'india', label: 'Country' },
  { id: 'state', label: 'States' },
  { id: 'city', label: 'Cities' },
];

const PACK_STATES: Partial<Record<RegionPack, StateCode[]>> = Object.fromEntries(
  (['north', 'south', 'west', 'east'] as const).map((r) => [r, PLAYABLE_STATES.filter((c) => INDIA_STATES[c].region === r)]),
);
const METROS = INDIA_CITIES.slice(0, 8);

const STATE_TILES = [...PLAYABLE_STATES].sort((a, b) => INDIA_STATES[a].name.localeCompare(INDIA_STATES[b].name));
const CITIES_SHOWN = 24;
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Distance that scores `points` on a map of the given size (inverse of the score curve). */
const missFor = (sizeKm: number, points: number) => (-Math.log(points / 5000) * sizeKm) / 10;

const HOW = [
  { title: 'Look around', body: 'You start on a random street. Walk, pan and zoom. Shop signs, scripts, number plates and the landscape are your clues.' },
  { title: 'Place your pin', body: 'Open the map in the corner and drop a pin where you think you are. Change your mind as often as you like.' },
  { title: 'Score points', body: `The closer the pin, the more points, up to 5,000 a round and ${formatScore(MAX_TOTAL)} a game. Smaller maps score more strictly.` },
];

interface LandingPageProps {
  settings: GameSettings;
  onSettingsChange: (s: GameSettings) => void;
  onStart: (s: GameSettings) => void;
  onQuickPlay: () => void;
  onMultiplayer: () => void;
  stats: LocalStats;
  matches: MatchRecord[];
  onResetStats: () => void;
  provider: ProviderId;
}

interface TileProps {
  selected: boolean;
  title: string;
  sub: string;
  stateCode?: StateCode | null;
  states?: readonly StateCode[];
  dots?: readonly LatLng[];
  point?: LatLng | null;
  onClick: () => void;
}

function MapTile({ selected, title, sub, stateCode, states, dots, point, onClick }: TileProps) {
  return (
    <li>
      <button type="button" className="map-tile" aria-pressed={selected} onClick={onClick}>
        <span className="map-tile__art">
          <IndiaLocator stateCode={stateCode} states={states} dots={dots} actual={point} />
        </span>
        <span className="map-tile__body">
          <strong>{title}</strong>
          <span>{sub}</span>
        </span>
        {selected && (
          <span className="map-tile__check" aria-hidden="true">
            <CheckIcon />
          </span>
        )}
      </button>
    </li>
  );
}

export function LandingPage({ settings, onSettingsChange, onStart, onQuickPlay, onMultiplayer, stats, matches, onResetStats, provider }: LandingPageProps) {
  const { enabled: accounts } = useAuth();
  const { room } = useMultiplayer();
  const [tab, setTab] = useState<GameScope>(settings.scope);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sizeKm, setSizeKm] = useState<number | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [allCities, setAllCities] = useState(false);
  const q = fold(cityQuery.trim());
  const cityMatches = q ? INDIA_CITIES.filter((c) => fold(c.name).includes(q) || fold(INDIA_STATES[c.state].name).includes(q)) : INDIA_CITIES;
  const cityTiles = q || allCities ? cityMatches : cityMatches.slice(0, CITIES_SHOWN);
  const avg = averageDistanceKm(stats);
  const update = (patch: Partial<GameSettings>) => onSettingsChange({ ...settings, ...patch });
  const pick = (patch: Partial<GameSettings>) => {
    update(patch);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    let alive = true;
    resolvePlayArea(settings).then((a) => alive && setSizeKm(a.sizeKm), () => undefined);
    return () => {
      alive = false;
    };
  }, [settings]);

  const city = settings.scope === 'city' ? CITY_BY_ID[settings.city] : null;
  const heroState = settings.scope === 'state' ? settings.state : (city?.state ?? null);
  const heroSub =
    settings.scope === 'state'
      ? INDIA_STATES[settings.state].kind === 'ut'
        ? 'Union territory'
        : 'State'
      : city
        ? `City · ${INDIA_STATES[city.state].name}`
        : 'Country';

  return (
    <>
      <Header onPlayNow={onQuickPlay} onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })} onMultiplayer={accounts ? onMultiplayer : undefined} />
      <div className="stars" aria-hidden="true" />
      <main className="landing" id="top">
        <section className="container hero" aria-labelledby="hero-title">
          <div className="hero-card">
            <div className="hero-card__media">
              <img src="/hero-jaipur.jpg" alt="" width={1280} height={853} />
              <div className="hero-card__locator" aria-hidden="true">
                <IndiaLocator
                  stateCode={heroState}
                  states={settings.scope === 'india' ? PACK_STATES[settings.pack] : undefined}
                  dots={settings.scope === 'india' && settings.pack === 'metro' ? METROS : undefined}
                  actual={city}
                />
              </div>
            </div>
            <div className="hero-card__info">
              <ul className="tags" aria-label="Map details">
                <li>India</li>
                <li>{SCOPE_INFO[settings.scope].label}</li>
                <li>{ROUNDS_PER_GAME} rounds</li>
                <li>{PROVIDER_LABELS[provider]}</li>
              </ul>
              <h1 id="hero-title" className="hero-card__title">
                {playAreaLabel(settings)}
              </h1>
              <p className="hero-card__sub">{heroSub}</p>
              <p className="hero-card__desc">{SCOPE_INFO[settings.scope].blurb}</p>
              <dl className="stat-row">
                <div>
                  <dd>{stats.bestScore ? formatScore(stats.bestScore) : '—'}</dd>
                  <dt>Your best</dt>
                </div>
                <div>
                  <dd>{stats.gamesCompleted}</dd>
                  <dt>Games played</dt>
                </div>
                <div>
                  <dd>{avg != null ? formatDistance(avg) : '—'}</dd>
                  <dt>Average miss</dt>
                </div>
                <div>
                  <dd>{sizeKm != null ? formatDistance(missFor(sizeKm, 4000)) : '—'}</dd>
                  <dt>Radius for 4,000 pts</dt>
                </div>
              </dl>
            </div>
          </div>

          <div className="play-bar">
            <div className="play-bar__opts">
              <Segmented name="Movement" value={settings.ruleset} options={RULESETS} onChange={(ruleset) => update({ ruleset })} />
              <SelectPill name="Round time limit" label="Time" value={settings.timer} options={TIMERS} onChange={(timer) => update({ timer })} />
              <span className="play-bar__note">{RULESET_INFO[settings.ruleset].note}</span>
            </div>
            <Button size="lg" className="play-bar__go" onClick={() => onStart(settings)} icon={<PlayIcon />}>
              Play
            </Button>
          </div>
          <ProviderNote provider={provider} />
        </section>

        {accounts && (
          <section className="container section" aria-labelledby="mp-banner-title">
            <div className="mp-banner">
              <div className="mp-banner__copy">
                <Eyebrow>{room ? `Room ${room.code}` : 'New · Multiplayer'}</Eyebrow>
                <h2 id="mp-banner-title" className="h2">
                  {room ? 'You’re still in a room' : 'Play with friends'}
                </h2>
                <p>
                  {room
                    ? 'Head back before the game starts without you.'
                    : 'Quick 1v1 against a random player, a private duel, or a party room for up to four. Same five streets for everyone.'}
                </p>
              </div>
              <ul className="mp-banner__modes" aria-hidden="true">
                <li>
                  <strong>1v1</strong>
                  <span>Quick match</span>
                </li>
                <li>
                  <strong>1v1</strong>
                  <span>Duel a friend</span>
                </li>
                <li>
                  <strong>2–4</strong>
                  <span>Party room</span>
                </li>
              </ul>
              <Button size="lg" onClick={onMultiplayer} icon={<PlayIcon />}>
                {room ? 'Back to room' : 'Play multiplayer'}
              </Button>
            </div>
          </section>
        )}

        <section id="maps" className="container section" aria-labelledby="maps-title">
          <div className="section-head">
            <h2 id="maps-title" className="h2">
              Choose a map
            </h2>
            <p>The whole country, one state or a single city.</p>
          </div>
          <div className="tabs" role="tablist" aria-label="Map type">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="tabs__tab" onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'city' && (
            <div className="city-search">
              <label className="city-search__field">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input type="search" placeholder="Search cities or states" value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} aria-label="Search cities" />
              </label>
              <span className="city-search__count">
                {q ? `${cityMatches.length} of ${INDIA_CITIES.length} cities` : `${INDIA_CITIES.length} cities`}
              </span>
            </div>
          )}
          <ul className="map-grid" role="tabpanel" aria-label={TABS.find((t) => t.id === tab)!.label}>
            {tab === 'india' &&
              REGION_PACKS.map((p) => (
                <MapTile
                  key={p.id}
                  selected={settings.scope === 'india' && settings.pack === p.id}
                  title={p.short}
                  sub={p.id === 'all' ? 'All 28 states and 8 UTs' : p.id === 'metro' ? 'Big-city streets' : 'Region'}
                  states={PACK_STATES[p.id]}
                  dots={p.id === 'metro' ? METROS : undefined}
                  onClick={() => pick({ scope: 'india', pack: p.id })}
                />
              ))}
            {tab === 'state' &&
              STATE_TILES.map((c) => (
                <MapTile
                  key={c}
                  selected={settings.scope === 'state' && settings.state === c}
                  title={INDIA_STATES[c].name}
                  sub={INDIA_STATES[c].kind === 'ut' ? 'Union territory' : 'State'}
                  stateCode={c}
                  onClick={() => pick({ scope: 'state', state: c })}
                />
              ))}
            {tab === 'city' &&
              cityTiles.map((c) => (
                <MapTile
                  key={c.id}
                  selected={settings.scope === 'city' && settings.city === c.id}
                  title={c.name}
                  sub={INDIA_STATES[c.state].name}
                  stateCode={c.state}
                  point={c}
                  onClick={() => pick({ scope: 'city', city: c.id })}
                />
              ))}
          </ul>
          {tab === 'city' && q && cityMatches.length === 0 && <p className="city-search__empty">No city matches “{cityQuery.trim()}”.</p>}
          {tab === 'city' && !q && !allCities && (
            <div className="city-search__more">
              <Button variant="secondary" onClick={() => setAllCities(true)}>
                Show all {INDIA_CITIES.length} cities
              </Button>
            </div>
          )}
        </section>

        <section id="how" className="container section" aria-labelledby="how-title">
          <div className="section-head">
            <h2 id="how-title" className="h2">
              How to play
            </h2>
          </div>
          <ol className="how">
            {HOW.map((s, i) => (
              <li key={s.title} className="panel how__step">
                <span className="how__num">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="h3">{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="games" className="container section" aria-labelledby="games-title">
          <div className="section-head">
            <h2 id="games-title" className="h2">
              My games
            </h2>
            <p>Saved on this device only.</p>
          </div>
          <div className="panel games">
            {matches.length > 0 ? (
              <ol className="games__list" aria-label="Recent games">
                {matches.slice(0, 6).map((m) => (
                  <li key={m.id} className="game-row">
                    <span className="game-row__date">{new Date(m.playedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                    <span className="game-row__map">
                      <strong>{playAreaLabel(m.settings)}</strong>
                      <span>
                        {RULESET_INFO[m.settings.ruleset].label} · {m.rounds.map((r) => r.locality).join(', ')}
                      </span>
                    </span>
                    <span className="game-row__score">
                      {formatScore(m.total)}
                      <Eyebrow>points</Eyebrow>
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="games__empty">
                <h3 className="h3">No games yet</h3>
                <p>Your last games and scores will show up here.</p>
                <Button onClick={() => onStart(settings)} icon={<PlayIcon />}>
                  Play {playAreaLabel(settings)}
                </Button>
              </div>
            )}
          </div>
          <div className="games__foot">
            {confirmReset ? (
              <span className="games__confirm">
                Delete all saved games and stats?
                <button
                  className="link-quiet"
                  onClick={() => {
                    onResetStats();
                    setConfirmReset(false);
                  }}
                >
                  Delete
                </button>
                <button className="link-quiet" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <button className="link-quiet" onClick={() => setConfirmReset(true)} disabled={stats.gamesCompleted === 0 && matches.length === 0}>
                Reset stats
              </button>
            )}
          </div>
        </section>
      </main>
      <Footer provider={provider} />
    </>
  );
}
