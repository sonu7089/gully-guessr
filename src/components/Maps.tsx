import L from 'leaflet';
import { useEffect, useMemo } from 'react';
import { AttributionControl, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import { INDIA_CENTER, INDIA_MAP_BOUNDS } from '../data/indiaBoundary';
import { greatCirclePath } from '../engine/geo';
import type { LatLng } from '../engine/types';

// Keyless, calm light-grey basemap (base + separate label layer) that suits the paper palette.
const TILE_BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_LABELS = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
const TILE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com">Esri</a> · &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const INK = '#211f25';
const PLUM = '#675380';
const LILAC = '#d6c8f2';

function guessPinSvg(label?: string) {
  return `<svg width="26" height="36" viewBox="0 0 26 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M13 35 2.5 19.5A12 12 0 1 1 23.5 19.5Z" fill="${INK}" />
    <rect x="8" y="8" width="10" height="10" fill="#fbfaf7" />
    ${label ? `<text x="13" y="16.5" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="9" fill="${INK}">${label}</text>` : ''}
  </svg>`;
}

function actualPinSvg(label?: string) {
  return `<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="17" cy="17" r="15" fill="${LILAC}" fill-opacity="0.85" stroke="${PLUM}" stroke-width="1" />
    <circle cx="17" cy="17" r="7.5" fill="${PLUM}" />
    ${label ? `<text x="17" y="20" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="700" font-size="9" fill="#fff">${label}</text>` : ''}
  </svg>`;
}

export const guessIcon = (label?: string) =>
  L.divIcon({ className: 'pin-icon', html: guessPinSvg(label), iconSize: [26, 36], iconAnchor: [13, 35] });
export const actualIcon = (label?: string) =>
  L.divIcon({ className: 'pin-icon', html: actualPinSvg(label), iconSize: [34, 34], iconAnchor: [17, 17] });

const maxBounds = L.latLngBounds(INDIA_MAP_BOUNDS).pad(0.25);

function Tiles() {
  return (
    <>
      <TileLayer url={TILE_BASE} attribution={TILE_ATTRIBUTION} maxNativeZoom={16} maxZoom={18} />
      <TileLayer url={TILE_LABELS} maxNativeZoom={16} maxZoom={18} />
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
    let wasHidden = el.clientWidth === 0 || el.clientHeight === 0;
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      const hidden = el.clientWidth === 0 || el.clientHeight === 0;
      // A map created inside a hidden bottom sheet needs re-framing once it becomes visible.
      if (wasHidden && !hidden && frameWhenShown) map.fitBounds(frameWhenShown, { animate: false });
      wasHidden = hidden;
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

const INDIA_FRAME = L.latLngBounds([[7, 68.5], [35.5, 97.5]]);

export function GuessMap({ guess, onGuess, sizeToken, disabled }: { guess: LatLng | null; onGuess: (p: LatLng) => void; sizeToken: unknown; disabled?: boolean }) {
  const icon = useMemo(() => guessIcon(), []);
  return (
    <MapContainer
      bounds={INDIA_FRAME}
      zoomSnap={0.25}
      minZoom={3}
      maxBounds={maxBounds}
      maxBoundsViscosity={0.8}
      worldCopyJump={false}
      style={{ height: '100%', width: '100%' }}
      attributionControl={false}
    >
      <Tiles />
      <AttributionControl prefix={false} position="bottomright" />
      <ClickToGuess onGuess={onGuess} disabled={disabled} />
      <SizeSync token={sizeToken} frameWhenShown={guess ? undefined : INDIA_FRAME} />
      {guess && <Marker position={[guess.lat, guess.lng]} icon={icon} keyboard={false} />}
    </MapContainer>
  );
}

function FitBounds({ points, padding = 60, topInset = 0 }: { points: LatLng[]; padding?: number; topInset?: number }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fit = () => {
      map.invalidateSize();
      if (points.length === 1) {
        map.setView([points[0].lat, points[0].lng], 9, { animate: !reduce });
        return;
      }
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        paddingTopLeft: [padding, padding + topInset],
        paddingBottomRight: [padding, padding],
        maxZoom: 13,
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
  }, [map, key, padding, topInset]);
  return null;
}

export interface Vector {
  actual: LatLng;
  guess: LatLng | null;
  label?: string;
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

export function ResultMap({ actual, guess }: { actual: LatLng; guess: LatLng | null }) {
  const points = guess ? [actual, guess] : [actual];
  return (
    <MapContainer center={[actual.lat, actual.lng]} zoom={5} minZoom={3} zoomSnap={0.25} zoomControl={false} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <Tiles />
      <ZoomControl position="bottomleft" />
      <SizeSync token={null} />
      <FitBounds points={points} padding={60} topInset={60} />
      <VectorLayer v={{ actual, guess }} highlighted />
    </MapContainer>
  );
}

export function SummaryMap({ vectors, selected, onSelect }: { vectors: Vector[]; selected: number | null; onSelect: (i: number) => void }) {
  const focus =
    selected != null && vectors[selected]
      ? [vectors[selected].actual, ...(vectors[selected].guess ? [vectors[selected].guess!] : [])]
      : vectors.flatMap((v) => (v.guess ? [v.actual, v.guess] : [v.actual]));
  return (
    <MapContainer center={INDIA_CENTER} zoom={4} minZoom={3} zoomSnap={0.25} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
      <Tiles />
      <SizeSync token={null} />
      <FitBounds points={focus} padding={50} />
      {vectors.map((v, i) => (
        <VectorLayer key={i} v={v} highlighted={selected === i} dimmed={selected != null && selected !== i} onSelect={() => onSelect(i)} />
      ))}
    </MapContainer>
  );
}
