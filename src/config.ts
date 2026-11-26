/** Single place to rename the game. */
export const GAME_TITLE = 'Gully Guessr';

export const ROUNDS_PER_GAME = 5;
export const MAX_ROUND_SCORE = 5000;
export const MAX_GAME_SCORE = ROUNDS_PER_GAME * MAX_ROUND_SCORE;

/** Minimum distance between any two rounds of the same game. */
export const MIN_ROUND_SEPARATION_KM = 35;

/** Locating pipeline: total attempts and how many run concurrently per batch. */
export const LOCATE_MAX_ATTEMPTS = 8;
/** Navigable providers get a bigger budget so rounds rarely degrade to a flat photo. */
export const STREET_VIEW_MAX_ATTEMPTS = 14;
export const LOCATE_BATCH_SIZE = 2;

export const OVERPASS_TIMEOUT_MS = 1500;
