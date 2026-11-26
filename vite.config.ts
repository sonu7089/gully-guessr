/// <reference types="vitest/config" />
import type { Server } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Runs the multiplayer game server inside `npm run dev`, on the same port as the site. */
function gameServer(projectId: string | undefined): Plugin {
  return {
    name: 'gully-game-server',
    apply: 'serve',
    async configureServer(server) {
      const http = server.httpServer as Server | null;
      if (!http) return;
      const mod = (await server.ssrLoadModule('/server/gameServer.ts')) as typeof import('./server/gameServer');
      const game = mod.attachGameServer(http, { projectId, log: (m) => server.config.logger.info(`[game] ${m}`, { timestamp: true }) });
      http.on('close', () => game.close());
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), gameServer(env.VITE_FIREBASE_PROJECT_ID)],
    build: {
      chunkSizeWarningLimit: 800,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    },
  };
});
