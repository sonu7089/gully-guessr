import { Segmented, SelectPill } from '../components/ui';
import { INDIA_CITIES } from '../data/indiaCities';
import { INDIA_STATES } from '../data/indiaStateClues';
import { REGION_PACKS } from '../engine/locationGenerator';
import { PLAYABLE_STATES, playAreaLabel } from '../engine/playArea';
import type { GameScope, GameSettings, Ruleset, TimerOption } from '../engine/types';
import { RULESET_INFO, SCOPE_INFO } from '../utils/labels';
import { DEFAULT_ROUND_SECONDS } from './protocol';

const SCOPES = (Object.keys(SCOPE_INFO) as GameScope[]).map((id) => ({ id, label: SCOPE_INFO[id].label }));
const RULESETS = (Object.keys(RULESET_INFO) as Ruleset[]).map((id) => ({ id, label: RULESET_INFO[id].label }));
const ROUND_TIMES: { id: TimerOption; label: string }[] = [
  { id: 60, label: '1 min' },
  { id: 90, label: '1:30 min' },
  { id: 120, label: '2 min' },
];
const PACKS = REGION_PACKS.map((p) => ({ id: p.id, label: p.short }));
const STATES = [...PLAYABLE_STATES].sort((a, b) => INDIA_STATES[a].name.localeCompare(INDIA_STATES[b].name)).map((c) => ({ id: c, label: INDIA_STATES[c].name }));
const CITIES = [...INDIA_CITIES].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, label: `${c.name} · ${INDIA_STATES[c.state].name}` }));

interface RoomSettingsProps {
  settings: GameSettings;
  roundSeconds: number;
  editable: boolean;
  onChange: (s: GameSettings) => void;
}

const roundLabel = (sec: number) => ROUND_TIMES.find((t) => t.id === sec)?.label ?? `${Math.round(sec / 60)} min`;

/** Map, movement and round-time picker; read-only for everyone but the host. */
export function RoomSettings({ settings, roundSeconds, editable, onChange }: RoomSettingsProps) {
  if (!editable) {
    return (
      <dl className="room-rules">
        <div>
          <dt>Map</dt>
          <dd>{playAreaLabel(settings)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{SCOPE_INFO[settings.scope].label}</dd>
        </div>
        <div>
          <dt>Movement</dt>
          <dd>{RULESET_INFO[settings.ruleset].label}</dd>
        </div>
        <div>
          <dt>Round time</dt>
          <dd>{roundLabel(roundSeconds)}</dd>
        </div>
      </dl>
    );
  }
  const update = (p: Partial<GameSettings>) => onChange({ ...settings, ...p });
  return (
    <div className="room-settings">
      <div className="room-settings__row">
        <span className="room-settings__label">Map type</span>
        <Segmented name="Map type" value={settings.scope} options={SCOPES} onChange={(scope) => update({ scope })} />
      </div>
      <div className="room-settings__row">
        <span className="room-settings__label">Map</span>
        {settings.scope === 'india' && <SelectPill name="Region" label="Region" value={settings.pack} options={PACKS} onChange={(pack) => update({ pack })} />}
        {settings.scope === 'state' && <SelectPill name="State" label="State" value={settings.state} options={STATES} onChange={(state) => update({ state })} />}
        {settings.scope === 'city' && <SelectPill name="City" label="City" value={settings.city} options={CITIES} onChange={(city) => update({ city })} />}
      </div>
      <div className="room-settings__row">
        <span className="room-settings__label">Movement</span>
        <Segmented name="Movement" value={settings.ruleset} options={RULESETS} onChange={(ruleset) => update({ ruleset })} />
      </div>
      <div className="room-settings__row">
        <span className="room-settings__label">Round time</span>
        <SelectPill
          name="Round time"
          label="Time"
          value={(settings.timer || DEFAULT_ROUND_SECONDS) as TimerOption}
          options={ROUND_TIMES}
          onChange={(timer) => update({ timer })}
        />
      </div>
    </div>
  );
}
