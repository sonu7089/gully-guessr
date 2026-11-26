import type { GameScope, Ruleset, TimerOption } from '../engine/types';

export const RULESET_INFO: Record<Ruleset, { label: string; note: string }> = {
  standard: { label: 'Move', note: 'Walk the streets, pan and zoom.' },
  nomove: { label: 'No move', note: 'Look around and zoom, but stay where you are.' },
  nmpz: { label: 'NMPZ', note: 'No moving, panning or zooming. One fixed view.' },
};

export const TIMER_INFO: Record<TimerOption, string> = {
  0: 'No limit',
  60: '1 min',
  90: '1:30 min',
  120: '2 min',
};

export const SCOPE_INFO: Record<GameScope, { label: string; blurb: string }> = {
  india: { label: 'Country', blurb: 'From the Himalayas to Kanyakumari: bazaars, highways, villages and hill towns.' },
  state: { label: 'State', blurb: 'One state, five streets. A smaller map means every kilometre counts.' },
  city: { label: 'City', blurb: 'Neighbourhood-level play inside one city. Read the signs, find the junction.' },
};
