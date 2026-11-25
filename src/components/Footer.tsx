import { GAME_TITLE } from '../config';
import type { ProviderId } from '../engine/imageryProviders';
import { ProviderChip, ProviderNote } from './ProviderChip';
import { PinMark } from './ui';

export function Footer({ provider }: { provider: ProviderId }) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="site-footer__left">
          <span className="wordmark" aria-hidden="true">
            <PinMark />
            <span>{GAME_TITLE}</span>
          </span>
          <ProviderChip provider={provider} />
          <ProviderNote provider={provider} />
        </div>
        <div className="site-footer__right">
          <div>
            <h4 className="eyebrow">Attributions</h4>
            <ul>
              <li>
                Map tiles © <a href="https://www.esri.com">Esri</a> · map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>{' '}
                contributors
              </li>
              <li>
                Street photography via <a href="https://commons.wikimedia.org">Wikimedia Commons</a> (credited per round)
              </li>
              <li>Geocoding by Nominatim · land checks via Overpass API</li>
              <li>Boundary: Natural Earth (public domain)</li>
              <li>
                Hero photo: “Jaipur – Hawa Mahal bazaar view”, Daniel Villafruela,{' '}
                <a href="https://commons.wikimedia.org/wiki/File:Jaipur-Hawa_Mahal-Bazaar_view-20131017.jpg">CC BY-SA 3.0</a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="eyebrow">Keyboard</h4>
            <ul>
              <li>
                <kbd>Space</kbd>Lock in guess / next round
              </li>
              <li>
                <kbd>M</kbd>Expand or collapse map
              </li>
              <li>
                <kbd>R</kbd>Reset camera view
              </li>
              <li>
                <kbd>+</kbd>
                <kbd>−</kbd>Zoom view
              </li>
              <li>
                <kbd>Esc</kbd>Collapse expanded map
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
