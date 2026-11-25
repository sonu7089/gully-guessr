import { useCallback, useEffect, useState } from 'react';
import { GAME_TITLE } from './config';
import { configuredProviderId, getProvider, resolveActiveProvider, type ImageryProvider } from './engine/imageryProviders';
import type { GameSettings } from './engine/types';
import { GamePage, type CompletedGame } from './pages/GamePage';
import { LandingPage } from './pages/LandingPage';
import { SummaryPage } from './pages/SummaryPage';
import { DEFAULT_SETTINGS, loadMatches, loadSettings, loadStats, recordMatch, resetStats, saveSettings } from './utils/storage';

type Screen = { name: 'landing'; scrollTo?: string } | { name: 'game'; settings: GameSettings; key: number } | { name: 'summary'; game: CompletedGame; isNewBest: boolean };

let providerPromise: Promise<ImageryProvider> | null = null;
const activeProvider = () => (providerPromise ??= resolveActiveProvider());

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'landing' });
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
    document.title = screen.name === 'game' ? `Playing · ${GAME_TITLE}` : GAME_TITLE;
    if (screen.name === 'landing') {
      const id = screen.scrollTo;
      requestAnimationFrame(() => (id ? document.getElementById(id)?.scrollIntoView() : window.scrollTo({ top: 0 })));
    }
  }, [screen]);

  const start = useCallback(async (s: GameSettings) => {
    saveSettings(s);
    setSettings(s);
    const p = await activeProvider();
    setProvider(p);
    setScreen({ name: 'game', settings: s, key: Date.now() });
  }, []);

  const quickPlay = useCallback(() => start({ ...DEFAULT_SETTINGS, pack: 'all', ruleset: 'standard', timer: 0 }), [start]);

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
    return <GamePage key={screen.key} settings={screen.settings} provider={provider} onExit={() => setScreen({ name: 'landing' })} onComplete={complete} />;
  }

  if (screen.name === 'summary') {
    return (
      <SummaryPage
        game={screen.game}
        isNewBest={screen.isNewBest}
        provider={provider.id}
        onPlayAgain={() => start(screen.game.settings)}
        onChangeMode={() => setScreen({ name: 'landing', scrollTo: 'regions' })}
        onHome={() => setScreen({ name: 'landing' })}
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
