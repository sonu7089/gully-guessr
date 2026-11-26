import L from 'leaflet';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AttributionControl, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { greatCirclePath } from '../engine/geo';
import { googleAuthFailed } from '../engine/googleMaps';
import { GOOGLE_KEY } from '../engine/imageryProviders';
import type { PlayArea } from '../engine/playArea';
import type { LatLng } from '../engine/types';
import type { Bounds } from '../utils/scoring';
import { GoogleGuessMap, GooglePlayersResultMap, GoogleResultMap, GoogleSummaryMap, type ResultView } from './GoogleMapViews';
import { ACTUAL_PIN, actualPinSvg, GUESS_PIN, guessPinSvg, INK, LILAC, MASK, PLUM, type PlayerPin, type Vector } from './mapPins';

export type { Vector } from './mapPins';

/** Google Maps when the key works, otherwise the keyless Leaflet/Esri maps below. */
function useGoogleMaps(): [boolean, () => void] {
  const [ok, setOk] = useState(() => !!GOOGLE_KEY && !googleAuthFailed());
  return [ok, useCallback(() => setOk(false), [])];
}

interface GuessMapProps {
  area: PlayArea;
  guess: LatLng | null;
  onGuess: (p: LatLng) => void;
  sizeToken: unknown;
  compact?: boolean;
  disabled?: boolean;
}

export function GuessMap(props: GuessMapProps) {
  const [google, fail] = useGoogleMaps();
  return google ? <GoogleGuessMap {...props} onFail={fail} /> : <LeafletGuessMap {...props} />;
}

export type { ResultView } from './GoogleMapViews';

interface ResultMapProps {
  area: PlayArea;
  actual: LatLng;
  guess: LatLng | null;
  view: ResultView;
  distanceLabel: string | null;
}

export function ResultMap(props: ResultMapProps) {
  const [google, fail] = useGoogleMaps();
  return google ? <GoogleResultMap {...props} onFail={fail} /> : <LeafletResultMap {...props} />;
}

interface PlayersResultMapProps {
  area: PlayArea;
  actual: LatLng;
  pins: PlayerPin[];
  view: ResultView;
}

export function PlayersResultMap(props: PlayersResultMapProps) {
  const [google, fail] = useGoogleMaps();
  return google ? <GooglePlayersResultMap {...props} onFail={fail} /> : <LeafletPlayersResultMap {...props} />;
}

export function SummaryMap(props: { area: PlayArea; vectors: Vector[]; selected: number | null; onSelect: (i: number) => void }) {
  const [google, fail] = useGoogleMaps();
  return google ? <GoogleSummaryMap {...props} onFail={fail} /> : <LeafletSummaryMap {...props} />;
}

/* ------------------------------------------------------------------ */
/* Leaflet fallback                                                    */
/* ------------------------------------------------------------------ */

// Keyless, calm light-grey basemap (base + separate label layer) that suits the paper palette.
const TILE_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com">Esri</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const guessIcon = (label?: string) =>
  L.divIcon({ className: 'pin-icon', html: guessPinSvg(label), iconSize: [GUESS_PIN.width, GUESS_PIN.height], iconAnchor: [...GUESS_PIN.anchor] });
const actualIcon = (label?: string) =>
  L.divIcon({ className: 'pin-icon', html: actualPinSvg(label), iconSize: [ACTUAL_PIN.width, ACTUAL_PIN.height], iconAnchor: [...ACTUAL_PIN.anchor] });

const toLeaflet = (b: Bounds) => L.latLngBounds([b.south, b.west], [b.north, b.east]);
const singlePointZoom = (area: PlayArea) => (area.scope === 'city' ? 14 : area.scope === 'state' ? 10 : 9);

function Tiles() {
  return (
    <>
      <TileLayer url={TILE_BASE} attribution={TILE_ATTRIBUTION} maxNativeZoom={16} maxZoom={18} />
      <TileLayer url={TILE_LABELS} maxNativeZoom={16} maxZoom={18} />
    </>
  );
}

const WORLD_RING: [number, number][] = [[-85, -180], [85, -180], [85, 180], [-85, 180]];

/** Fades everything outside the play area and outlines it so the guess area reads at a glance. */
function AreaHighlight({ area, mask = true }: { area: PlayArea; mask?: boolean }) {
  const rings = useMemo(() => area.outline.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])), [area]);
  if (rings.length === 0) return null;
  return (
    <>
      {mask && <Polygon positions={[WORLD_RING, ...rings]} interactive={false} pathOptions={{ stroke: false, fillColor: MASK, fillOpacity: 0.72 }} />}
      <Polygon positions={rings} interactive={false} pathOptions={{ color: PLUM, weight: 1.25, opacity: 0.9, fillColor: LILAC, fillOpacity: mask ? 0.12 : 0.06 }} />
    </>
  );
}

function ClickToGuess({ onGuess, disabled }: { onGuess: (p: LatLng) => void; disabled?: boolean }) {
  useMapEvents({
    click(e) {
      if (!disabled) onGuess({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Keeps Leaflet's internal size in sync while the container animates. */
function SizeSync({ token, frameWhenShown }: { token: unknown; frameWhenShown?: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 120);
    const t2 = setTimeout(() => map.invalidateSize(), 260);
    const el = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      // Until a pin is placed, keep the whole frame in view as the panel grows, shrinks or un-hides.
      if (frameWhenShown && el.clientWidth > 0 && el.clientHeight > 0) map.fitBounds(frameWhenShown, { animate: false });
    });
    ro.observe(el);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
    };
  }, [map, token, frameWhenShown]);
  return null;
}

function LeafletGuessMap({ area, guess, onGuess, sizeToken, compact, disabled }: GuessMapProps) {
  const icon = useMemo(() => guessIcon(), []);
  const frame = useMemo(() => toLeaflet(area.bounds), [area]);
  const maxBounds = useMemo(() => frame.pad(0.6), [frame]);
  return (
    <MapContainer
      bounds={frame}
      zoomSnap={0.25}
      minZoom={3}
      maxBounds={maxBounds}
      maxBoundsViscosity={0.8}
      worldCopyJump={false}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
      attributionControl={false}
    >
      <Tiles />
      <AreaHighlight area={area} />
      {!compact && <ZoomControl position="topleft" />}
      <AttributionControl prefix={false} position="bottomright" />
      <ClickToGuess onGuess={onGuess} disabled={disabled} />
      <SizeSync token={sizeToken} frameWhenShown={guess ? undefined : frame} />
      {guess && <Marker position={[guess.lat, guess.lng]} icon={icon} keyboard={false} />}
    </MapContainer>
  );
}

function FitBounds({ points, padding = 60, topInset = 0, singleZoom }: { points: LatLng[]; padding?: number; topInset?: number; singleZoom: number }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fit = () => {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], singleZoom, { animate: !reduce });
        return;
      }
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        paddingTopLeft: [padding, padding + topInset],
        paddingBottomRight: [padding, padding],
        maxZoom: 16,
        animate: !reduce,
      });
    };
    fit();
    const t = setTimeout(fit, 250);
    map.on('resize', fit);
    return () => {
      clearTimeout(t);
      map.off('resize', fit);
    };
  }, [map, key, padding, topInset, singleZoom]);
  return null;
}

function VectorLayer({ v, highlighted, dimmed, onSelect }: { v: Vector; highlighted?: boolean; dimmed?: boolean; onSelect?: () => void }) {
  const path = useMemo(() => (v.guess ? greatCirclePath(v.guess, v.actual) : null), [v.guess, v.actual]);
  const gIcon = useMemo(() => guessIcon(v.label), [v.label]);
  const aIcon = useMemo(() => actualIcon(v.label), [v.label]);
  const opacity = dimmed ? 0.35 : 1;
  const handlers = onSelect ? { click: onSelect } : undefined;
  return (
    <>
      {path && (
        <Polyline
          positions={path}
          pathOptions={{ color: INK, weight: highlighted ? 3 : 2, dashArray: '6 7', opacity }}
          eventHandlers={handlers}
        />
      )}
      {v.guess && <Marker position={[v.guess.lat, v.guess.lng]} icon={gIcon} opacity={opacity} eventHandlers={handlers} />}
      <Marker position={[v.actual.lat, v.actual.lng]} icon={aIcon} opacity={opacity} zIndexOffset={highlighted ? 1000 : 0} eventHandlers={handlers} />
    </>
  );
}

function FitArea({ bounds }: { bounds: Bounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(toLeaflet(bounds), { padding: [60, 60] });
  }, [map, bounds]);
  return null;
}

function LeafletResultMap({ area, actual, guess, view }: ResultMapProps) {
  const points = view === 'spot' || !guess ? [actual] : [actual, guess];
  return (
    <MapContainer center={[actual.lat, actual.lng]} zoom={5} minZoom={3} zoomSnap={0.25} zoomControl={false} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <Tiles />
      <AreaHighlight area={area} mask={false} />
      <ZoomControl position="bottomright" />
      <SizeSync token={null} />
      {view === 'area' ? (
        <FitArea bounds={area.bounds} />
      ) : (
        <FitBounds points={points} padding={60} topInset={60} singleZoom={view === 'spot' ? 16 : singlePointZoom(area)} />
      )}
      <VectorLayer v={{ actual, guess }} highlighted />
    </MapContainer>
  );
}

function PlayerPinLayer({ pin, actual }: { pin: PlayerPin; actual: LatLng }) {
  const path = useMemo(() => greatCirclePath(pin.point, actual), [pin.point, actual]);
  const icon = useMemo(
    () => L.divIcon({ className: 'pin-icon', html: guessPinSvg(pin.label, pin.color), iconSize: [GUESS_PIN.width, GUESS_PIN.height], iconAnchor: [...GUESS_PIN.anchor] }),
    [pin.label, pin.color],
  );
  return (
    <>
      <Polyline positions={path} pathOptions={{ color: pin.color, weight: 2.5, dashArray: '6 7' }} />
      <Marker position={[pin.point.lat, pin.point.lng]} icon={icon} title={pin.caption} />
    </>
  );
}

function LeafletPlayersResultMap({ area, actual, pins, view }: PlayersResultMapProps) {
  const aIcon = useMemo(() => actualIcon(), []);
  const points = view === 'spot' ? [actual] : [actual, ...pins.map((p) => p.point)];
  return (
    <MapContainer center={[actual.lat, actual.lng]} zoom={5} minZoom={3} zoomSnap={0.25} zoomControl={false} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <Tiles />
      <AreaHighlight area={area} mask={false} />
      <ZoomControl position="bottomright" />
      <SizeSync token={null} />
      {view === 'area' ? (
        <FitArea bounds={area.bounds} />
      ) : (
        <FitBounds points={points} padding={60} topInset={60} singleZoom={view === 'spot' ? 16 : singlePointZoom(area)} />
      )}
      {pins.map((p, i) => (
        <PlayerPinLayer key={`${i}-${p.caption}`} pin={p} actual={actual} />
      ))}
      <Marker position={[actual.lat, actual.lng]} icon={aIcon} zIndexOffset={1000} />
    </MapContainer>
  );
}

function LeafletSummaryMap({ area, vectors, selected, onSelect }: { area: PlayArea; vectors: Vector[]; selected: number | null; onSelect: (i: number) => void }) {
  const focus =
    selected != null && vectors[selected]
      ? [vectors[selected].actual, ...(vectors[selected].guess ? [vectors[selected].guess!] : [])]
      : vectors.flatMap((v) => (v.guess ? [v.actual, v.guess] : [v.actual]));
  const center = toLeaflet(area.bounds).getCenter();
  return (
    <MapContainer center={center} zoom={4} minZoom={3} zoomSnap={0.25} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <Tiles />
      <AreaHighlight area={area} mask={false} />
      <SizeSync token={null} />
      <FitBounds points={focus} padding={50} singleZoom={singlePointZoom(area)} />
      {vectors.map((v, i) => (
        <VectorLayer key={i} v={v} highlighted={selected === i} dimmed={selected != null && selected !== i} onSelect={() => onSelect(i)} />
      ))}
    </MapContainer>
  );
}
