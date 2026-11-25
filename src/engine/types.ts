export type Archetype =
  | 'urban_town'
  | 'highway_corridor'
  | 'rural_settlement'
  | 'scenic_coastal_hill'
  | 'forest_wilderness';

export type RegionPack = 'all' | 'north' | 'south' | 'west' | 'east' | 'metro';
export type Region = Exclude<RegionPack, 'all' | 'metro'>;

export type Ruleset = 'standard' | 'nomove' | 'nmpz';
export type TimerOption = 0 | 60 | 90 | 120;

export type StateCode =
  | 'AP' | 'AR' | 'AS' | 'BR' | 'CG' | 'GA' | 'GJ' | 'HR' | 'HP' | 'JH'
  | 'KA' | 'KL' | 'MP' | 'MH' | 'MN' | 'ML' | 'MZ' | 'NL' | 'OD' | 'PB'
  | 'RJ' | 'SK' | 'TN' | 'TG' | 'TR' | 'UP' | 'UK' | 'WB'
  | 'AN' | 'CH' | 'DD' | 'DL' | 'JK' | 'LA' | 'LD' | 'PY';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Anchor extends LatLng {
  id: string;
  name: string;
  state: StateCode;
  archetype: Archetype;
  jitterRadiusKm: number;
  /** Neighbourhood anchors used by the Metro Cities pack. */
  metro?: boolean;
}

export interface LocationCandidate extends LatLng {
  anchor: Anchor;
  archetype: Archetype;
}

export interface GameSettings {
  pack: RegionPack;
  ruleset: Ruleset;
  timer: TimerOption;
}
