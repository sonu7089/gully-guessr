import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles/app.css';
import './styles/multiplayer.css';
import App from './App';
import { AuthProvider } from './auth/AuthProvider';
import { GAME_TITLE } from './config';
import { MultiplayerProvider } from './multiplayer/MultiplayerProvider';

document.title = GAME_TITLE;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <MultiplayerProvider>
        <App />
      </MultiplayerProvider>
    </AuthProvider>
  </StrictMode>,
);
