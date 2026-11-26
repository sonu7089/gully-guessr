import { useCallback, useEffect, useState } from 'react';
import { GAME_TITLE } from './config';
import { activeProvider } from './engine/activeProvider';
import { configuredProviderId, getProvider, type ImageryProvider } from './engine/imageryProviders';
import { resolvePlayArea, type PlayArea } from './engine/playArea';
import type { GameSettings } from './engine/types';
import { wasInRoom } from './multiplayer/MultiplayerProvider';
import { CODE_LENGTH, normalizeCode } from './multiplayer/protocol';
import { GamePage, type CompletedGame } from './pages/GamePage';
import { LandingPage } from './pages/LandingPage';
import { MultiplayerPage } from './pages/MultiplayerPage';
import { SummaryPage } from './pages/SummaryPage';
import { DEFAULT_SETTINGS, loadMatches, loadSettings, loadStats, recordMatch, resetStats, saveSettings } from './utils/storage';

type Screen =
  | { name: 'landing'; scrollTo?: string }
  | { name: 'multiplayer' }
  | { name: 'game'; settings: GameSettings; area: PlayArea; key: number }
  | { name: 'summary'; game: CompletedGame; isNewBest: boolean };

/** `?room=ABCDE` invite links open multiplayer and join that room. */
function readInvite(): string | null {
  const code = normalizeCode(new URLSearchParams(location.search).get('room') ?? '');
  return code.length === CODE_LENGTH ? code : null;
}

export default function App() {
  const [invite, setInvite] = useState(readInvite);
  const [screen, setScreen] = useState<Screen>(() => (invite || wasInRoom() ? { name: 'multiplayer' } : { name: 'landing' }));
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [stats, setStats] = useState(() => loadStats());
  const [matches, setMatches] = useState(() => loadMatches());
  const [provider, setProvider] = useState<ImageryProvider>(() => getProvider(configuredProviderId()));

  useEffect(() => {
    let alive = true;
    activeProvider().then((p) => alive && setProvider(p));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    document.title = screen.name === 'game' ? `Playing · ${GAME_TITLE}` : screen.name === 'multiplayer' ? `Multiplayer · ${GAME_TITLE}` : GAME_TITLE;
    if (screen.name === 'landing') {
      const id = screen.scrollTo;
      requestAnimationFrame(() => (id ? document.getElementById(id)?.scrollIntoView() : window.scrollTo({ top: 0 })));
    } else if (screen.name === 'multiplayer') {
      window.scrollTo({ top: 0 });
    }
  }, [screen]);

  const clearInvite = useCallback(() => {
    setInvite(null);
    const url = new URL(location.href);
    url.searchParams.delete('room');
    history.replaceState(null, '', url);
  }, []);

  const start = useCallback(async (s: GameSettings) => {
    saveSettings(s);
    setSettings(s);
    const [p, area] = await Promise.all([activeProvider(), resolvePlayArea(s)]);
    setProvider(p);
    setScreen({ name: 'game', settings: s, area, key: Date.now() });
  }, []);

  const quickPlay = useCallback(() => start({ ...DEFAULT_SETTINGS, scope: 'india', pack: 'all', ruleset: 'standard', timer: 0 }), [start]);
  const home = useCallback(() => setScreen({ name: 'landing' }), []);
  const multiplayer = useCallback(() => setScreen({ name: 'multiplayer' }), []);

  const complete = useCallback((game: CompletedGame) => {
    const { stats: next, isNewBest } = recordMatch({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      playedAt: new Date().toISOString(),
      total: game.total,
      settings: game.settings,
      rounds: game.rounds,
    });
    setStats(next);
    setMatches(loadMatches());
    setScreen({ name: 'summary', game, isNewBest });
  }, []);

  if (screen.name === 'game') {
    return <GamePage key={screen.key} settings={screen.settings} area={screen.area} provider={provider} onExit={home} onComplete={complete} />;
  }

  if (screen.name === 'multiplayer') {
    return <MultiplayerPage settings={settings} provider={provider} inviteCode={invite} onInviteHandled={clearInvite} onHome={home} onSinglePlayer={quickPlay} />;
  }

  if (screen.name === 'summary') {
    return (
      <SummaryPage
        game={screen.game}
        isNewBest={screen.isNewBest}
        provider={provider.id}
        onPlayAgain={() => start(screen.game.settings)}
        onChangeMode={() => setScreen({ name: 'landing', scrollTo: 'maps' })}
        onHome={home}
      />
    );
  }

  return (
    <LandingPage
      settings={settings}
      onSettingsChange={(s) => {
        setSettings(s);
        saveSettings(s);
      }}
      onStart={start}
      onQuickPlay={quickPlay}
      onMultiplayer={multiplayer}
      stats={stats}
      matches={matches}
      onResetStats={() => {
        resetStats();
        setStats(loadStats());
        setMatches(loadMatches());
      }}
      provider={provider.id}
    />
  );
}
