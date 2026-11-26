import type { ProviderId } from '../engine/imageryProviders';
import { ProviderChip, ProviderNote } from './ProviderChip';
import { Logo, Wordmark } from './ui';

export function Footer({ provider }: { provider: ProviderId }) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__brand">
          <span className="wordmark" aria-hidden="true">
            <Logo />
            <Wordmark />
          </span>
          <p>A street geography game for India. Play solo without an account, or log in to take on friends and random players.</p>
          <ProviderChip provider={provider} />
          <ProviderNote provider={provider} />
        </div>
        <div>
          <h4 className="eyebrow">Shortcuts</h4>
          <ul className="keys">
            <li>
              <kbd>Space</kbd>Guess / next round
            </li>
            <li>
              <kbd>M</kbd>Enlarge the map
            </li>
            <li>
              <kbd>R</kbd>Return to start
            </li>
            <li>
              <kbd>+</kbd>
              <kbd>−</kbd>Zoom the view
            </li>
            <li>
              <kbd>Esc</kbd>Shrink the map
            </li>
          </ul>
        </div>
        <div>
          <h4 className="eyebrow">Credits</h4>
          <ul className="credits">
            <li>
              {provider === 'google' ? 'Maps by Google · fallback ' : 'Map '}tiles © <a href="https://www.esri.com">Esri</a> · map data ©{' '}
              <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors
            </li>
            <li>
              Street photography via <a href="https://commons.wikimedia.org">Wikimedia Commons</a> (credited per round)
            </li>
            <li>Geocoding by Nominatim · land checks via Overpass API</li>
            <li>Boundary: Natural Earth (public domain) · state boundaries © OpenStreetMap contributors</li>
            <li>
              Hero photo: “Jaipur – Hawa Mahal bazaar view”, Daniel Villafruela,{' '}
              <a href="https://commons.wikimedia.org/wiki/File:Jaipur-Hawa_Mahal-Bazaar_view-20131017.jpg">CC BY-SA 3.0</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
