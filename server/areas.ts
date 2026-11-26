import { CITY_BY_ID, INDIA_CITIES } from '../src/data/indiaCities';
import shapesJson from '../src/data/stateShapes.json';
import { cityArea, indiaArea, stateArea, type StateShapes } from '../src/engine/playArea';
import type { GameSettings } from '../src/engine/types';

const shapes = shapesJson as unknown as StateShapes;

/** Same play-area sizes the browser uses, so server-side scores match single-player. */
export function sizeKmFor(settings: GameSettings): number {
  if (settings.scope === 'state') return stateArea(settings.state, shapes[settings.state]).sizeKm;
  if (settings.scope === 'city') return cityArea(CITY_BY_ID[settings.city] ?? INDIA_CITIES[0]).sizeKm;
  return indiaArea(settings.pack).sizeKm;
}
