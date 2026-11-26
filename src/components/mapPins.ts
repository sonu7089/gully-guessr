import type { LatLng } from '../engine/types';

export interface Vector {
  actual: LatLng;
  guess: LatLng | null;
  label?: string;
}

export const INK = '#10101c';
export const PLUM = '#7950e5';
export const LILAC = '#7950e5';
export const MASK = '#e6e3f5';
const GUESS_FILL = '#7950e5';
const ACTUAL_FILL = '#e94555';
const WHITE = '#ffffff';

export const GUESS_PIN = { width: 32, height: 42, anchor: [16, 40] as const };
export const ACTUAL_PIN = { width: 34, height: 34, anchor: [17, 17] as const };

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const labelText = (label: string, x: number, y: number, fill: string) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Nunito, sans-serif" font-style="italic" font-weight="900" font-size="13" fill="${fill}">${escapeHtml(label)}</text>`;

/** Seat colours for multiplayer pins, in join order. */
export const PLAYER_COLORS = ['#7950e5', '#ffa00c', '#1fb8cd', '#e84393'] as const;

/** A player's guess placed on a reveal map. */
export interface PlayerPin {
  point: LatLng;
  color: string;
  label: string;
  caption: string;
}

/** Your guess: purple map pin with a white rim. */
export function guessPinSvg(label?: string, fill: string = GUESS_FILL) {
  return `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M16 2.5C8.5 2.5 2.5 8.5 2.5 16c0 10 13.5 23.5 13.5 23.5S29.5 26 29.5 16C29.5 8.5 23.5 2.5 16 2.5z" fill="${fill}" stroke="${WHITE}" stroke-width="2.6" stroke-linejoin="round"/>
    ${label ? labelText(label.replace(/^0/, ''), 16, 20.5, WHITE) : `<circle cx="16" cy="16" r="5" fill="${WHITE}"/>`}
  </svg>`;
}

/** The correct location: a flag on a white disc (or the round number on red). */
export function actualPinSvg(label?: string) {
  return `<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${
      label
        ? `<circle cx="17" cy="17" r="14.5" fill="${ACTUAL_FILL}" stroke="${WHITE}" stroke-width="2.6"/>${labelText(label.replace(/^0/, ''), 17, 21.5, WHITE)}`
        : `<circle cx="17" cy="17" r="14.5" fill="${WHITE}" stroke="${INK}" stroke-width="2.4"/>
           <path d="M13.5 9.5v15" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
           <path d="M13.5 9.8h9.2l-2.4 3.3 2.4 3.3h-9.2z" fill="${ACTUAL_FILL}" stroke="${ACTUAL_FILL}" stroke-width="1" stroke-linejoin="round"/>`
    }
  </svg>`;
}
