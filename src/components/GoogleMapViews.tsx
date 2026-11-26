import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Ring } from '../data/indiaBoundary';
import { greatCirclePath } from '../engine/geo';
import { loadGoogleMaps, mapsLibrary, onGoogleAuthFailure } from '../engine/googleMaps';
import { GOOGLE_KEY } from '../engine/imageryProviders';
import type { PlayArea } from '../engine/playArea';
import type { LatLng } from '../engine/types';
import type { Bounds } from '../utils/scoring';
import { ACTUAL_PIN, actualPinSvg, escapeHtml, GUESS_PIN, guessPinSvg, INK, LILAC, MASK, PLUM, type PlayerPin, type Vector } from './mapPins';

export type ResultView = 'both' | 'spot' | 'area';

const STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const BASE_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  keyboardShortcuts: false,
  isFractionalZoomEnabled: true,
  backgroundColor: MASK,
  controlSize: 30,
  styles: STYLES,
};

/** Outer ring of the fade mask. A box around India rather than the whole world keeps every edge well under 180°. */
const MASK_OUTER: google.maps.LatLngLiteral[] = [
  { lat: -10, lng: 40 },
  { lat: 55, lng: 40 },
  { lat: 55, lng: 130 },
  { lat: -10, lng: 130 },
];

type Path = google.maps.LatLngLiteral[];

const literal = (p: LatLng): google.maps.LatLngLiteral => ({ lat: p.lat, lng: p.lng });
const boundsLiteral = (b: Bounds): google.maps.LatLngBoundsLiteral => ({ south: b.south, west: b.west, north: b.north, east: b.east });
const ringPath = (ring: Ring): Path => ring.map(([lng, lat]) => ({ lat, lng }));
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function padBounds(b: Bounds, f: number): Bounds {
  const dy = (b.north - b.south) * f;
  const dx = (b.east - b.west) * f;
  return { south: b.south - dy, west: b.west - dx, north: b.north + dy, east: b.east + dx };
}

function isClockwise(path: Path): boolean {
  let s = 0;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) s += (path[i].lng - path[j].lng) * (path[i].lat + path[j].lat);
  return s > 0;
}

/** Google Maps only cuts a hole when the inner ring winds opposite to the outer one. */
const wound = (path: Path, clockwise: boolean): Path => (isClockwise(path) === clockwise ? path : [...path].reverse());

const singlePointZoom = (area: PlayArea) => (area.scope === 'city' ? 14 : area.scope === 'state' ? 11 : 9);

/* ------------------------------------------------------------------ */

function useGoogleMap(options: () => google.maps.MapOptions, onFail: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const init = useRef(options);
  const fail = useRef(onFail);
  fail.current = onFail;
  useEffect(() => {
    let alive = true;
    loadGoogleMaps(GOOGLE_KEY)
      .then(() => mapsLibrary())
      .then(({ Map }) => {
        if (alive && ref.current) setMap(new Map(ref.current, { ...BASE_OPTIONS, ...init.current() }));
      })
      .catch(() => alive && fail.current());
    const off = onGoogleAuthFailure(() => fail.current());
    return () => {
      alive = false;
      off();
    };
  }, []);
  return [ref, map] as const;
}

/** Fades everything outside the play area and outlines it. City games have no outline, so nothing is drawn. */
function useAreaOverlay(map: google.maps.Map | null, area: PlayArea, mask: boolean) {
  useEffect(() => {
    if (!map || area.outline.length === 0) return;
    const shade = mask
      ? new google.maps.Polygon({
          map,
          paths: [wound(MASK_OUTER, true), ...area.outline.map((r) => wound(ringPath(r), false))],
          clickable: false,
          strokeOpacity: 0,
          fillColor: MASK,
          fillOpacity: 0.6,
        })
      : null;
    const outline = new google.maps.Polygon({
      map,
      paths: area.outline.map(ringPath),
      clickable: false,
      strokeColor: PLUM,
      strokeOpacity: 0.85,
      strokeWeight: 2,
      fillColor: LILAC,
      fillOpacity: mask ? 0.08 : 0.04,
    });
    return () => {
      shade?.setMap(null);
      outline.setMap(null);
    };
  }, [map, area, mask]);
}

/** Calls `fit` now and (once per frame) whenever the container resizes. */
function useRefit(map: google.maps.Map | null, el: RefObject<HTMLDivElement | null>, fit: () => void, deps: unknown[]) {
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    const node = el.current;
    if (!map || !node) return;
    const run = () => node.clientWidth > 0 && node.clientHeight > 0 && fitRef.current();
    run();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(run);
    });
    ro.observe(node);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [map, ...deps]);
}

function fitPoints(map: google.maps.Map, points: LatLng[], padding: google.maps.Padding, singleZoom: number) {
  if (points.length === 0) return;
  const first = points[0];
  if (points.every((p) => Math.abs(p.lat - first.lat) < 1e-5 && Math.abs(p.lng - first.lng) < 1e-5)) {
    map.setCenter(literal(first));
    map.setZoom(singleZoom);
    return;
  }
  const b = new google.maps.LatLngBounds();
  points.forEach((p) => b.extend(literal(p)));
  map.fitBounds(b, padding);
  google.maps.event.addListenerOnce(map, 'idle', () => {
    if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
  });
}

/* ------------------------------------------------------------------ */

interface OverlayOptions {
  anchor: readonly [number, number];
  size?: { width: number; height: number };
  className?: string;
  zIndex?: number;
  opacity?: number;
  onClick?: () => void;
}

/** HTML drawn at a lat/lng through an OverlayView (Advanced Markers need a cloud map id; the classic Marker is deprecated). */
function defineOverlay() {
  return class HtmlOverlay extends google.maps.OverlayView {
    readonly el = document.createElement('div');
    readonly position: google.maps.LatLngLiteral;
    readonly anchor: readonly [number, number];
    readonly interactive: boolean;

    constructor(position: google.maps.LatLngLiteral, html: string, opts: OverlayOptions) {
      super();
      this.position = position;
      this.anchor = opts.anchor;
      this.interactive = !!opts.onClick;
      this.el.className = opts.className ?? '';
      this.el.innerHTML = html;
      Object.assign(this.el.style, {
        position: 'absolute',
        width: opts.size ? `${opts.size.width}px` : '',
        height: opts.size ? `${opts.size.height}px` : '',
        zIndex: String(opts.zIndex ?? 0),
        opacity: String(opts.opacity ?? 1),
        cursor: this.interactive ? 'pointer' : '',
        pointerEvents: this.interactive ? 'auto' : 'none',
      });
      const onClick = opts.onClick;
      if (onClick) {
        google.maps.OverlayView.preventMapHitsAndGesturesFrom(this.el);
        this.el.addEventListener('click', onClick);
      }
    }

    onAdd() {
      const panes = this.getPanes()!;
      (this.interactive ? panes.overlayMouseTarget : panes.floatPane).appendChild(this.el);
    }

    draw() {
      const pt = this.getProjection()?.fromLatLngToDivPixel(this.position);
      if (!pt) return;
      this.el.style.left = `${pt.x - this.anchor[0]}px`;
      this.el.style.top = `${pt.y - this.anchor[1]}px`;
    }

    onRemove() {
      this.el.remove();
    }
  };
}

let OverlayClass: ReturnType<typeof defineOverlay> | null = null;
const Overlay = () => (OverlayClass ??= defineOverlay());

interface PinOptions {
  label?: string;
  caption?: string;
  color?: string;
  pulse?: boolean;
  zIndex?: number;
  opacity?: number;
  onClick?: () => void;
}

function makePin(p: LatLng, kind: 'guess' | 'actual', opts: PinOptions = {}) {
  const spec = kind === 'guess' ? GUESS_PIN : ACTUAL_PIN;
  const svg = kind === 'guess' ? guessPinSvg(opts.label, opts.color) : actualPinSvg(opts.label);
  const tint = opts.color ? ` style="background:${opts.color}"` : '';
  const caption = opts.caption ? `<span class="map-cap map-cap--${kind}"${tint}>${escapeHtml(opts.caption)}</span>` : '';
  const O = Overlay();
  return new O(literal(p), caption + svg, {
    anchor: spec.anchor,
    size: spec,
    className: `map-pin map-pin--${kind}${opts.pulse ? ' map-pin--pulse' : ''}`,
    zIndex: opts.zIndex,
    opacity: opts.opacity,
    onClick: opts.onClick,
  });
}

function dashedLine(map: google.maps.Map, a: LatLng, b: LatLng, weight: number, opacity: number, onClick?: () => void, color: string = INK) {
  const line = new google.maps.Polyline({
    map,
    path: [literal(a), literal(b)],
    geodesic: true,
    clickable: !!onClick,
    strokeOpacity: 0,
    strokeWeight: 12,
    icons: [{ icon: { path: 'M 0,-1 0,1', strokeColor: color, strokeOpacity: opacity, strokeWeight: weight, scale: 3.5 }, offset: '0', repeat: '13px' }],
  });
  if (onClick) line.addListener('click', onClick);
  return line;
}

interface VectorOptions {
  highlighted?: boolean;
  dimmed?: boolean;
  onSelect?: () => void;
  /** Reveal mode: "You" / "Here!" captions, a distance tag and marching dashes. */
  reveal?: { distanceLabel: string | null };
}

function drawVector(map: google.maps.Map, v: Vector, opts: VectorOptions = {}) {
  const opacity = opts.dimmed ? 0.35 : 1;
  const layers: { setMap(m: google.maps.Map | null): void }[] = [];
  let timer = 0;
  if (v.guess) {
    const line = dashedLine(map, v.guess, v.actual, opts.highlighted ? 3.5 : 2.5, opacity, opts.onSelect);
    layers.push(line);
    layers.push(makePin(v.guess, 'guess', { label: v.label, caption: opts.reveal ? 'Your guess' : undefined, opacity, onClick: opts.onSelect, zIndex: 1 }));
    if (opts.reveal?.distanceLabel) {
      const path = greatCirclePath(v.guess, v.actual);
      const [lat, lng] = path[Math.floor(path.length / 2)];
      const O = Overlay();
      layers.push(new O({ lat, lng }, `<span class="map-dist">${opts.reveal.distanceLabel}</span>`, { anchor: [0, 0], zIndex: 2 }));
    }
    if (opts.reveal && !reducedMotion()) {
      let offset = 0;
      timer = window.setInterval(() => {
        offset = (offset + 1) % 13;
        const icons = line.get('icons') as google.maps.IconSequence[];
        icons[0].offset = `${offset}px`;
        line.set('icons', icons);
      }, 70);
    }
  }
  layers.push(
    makePin(v.actual, 'actual', {
      label: v.label,
      caption: opts.reveal ? 'Correct location' : undefined,
      pulse: !!opts.reveal,
      opacity,
      onClick: opts.onSelect,
      zIndex: opts.highlighted ? 3 : 2,
    }),
  );
  layers.forEach((l) => l.setMap(map));
  return () => {
    window.clearInterval(timer);
    layers.forEach((l) => l.setMap(null));
  };
}

/* ------------------------------------------------------------------ */

interface GuessMapProps {
  area: PlayArea;
  guess: LatLng | null;
  onGuess: (p: LatLng) => void;
  compact?: boolean;
  disabled?: boolean;
  onFail: () => void;
}

export function GoogleGuessMap({ area, guess, onGuess, compact, disabled, onFail }: GuessMapProps) {
  const [ref, map] = useGoogleMap(
    () => ({
      gestureHandling: 'greedy',
      draggableCursor: 'crosshair',
      draggingCursor: 'grabbing',
      zoomControl: true,
      zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
      restriction: { latLngBounds: boundsLiteral(padBounds(area.bounds, 0.6)), strictBounds: false },
    }),
    onFail,
  );
  useAreaOverlay(map, area, true);

  const handlers = useRef({ onGuess, disabled });
  handlers.current = { onGuess, disabled };
  useEffect(() => {
    if (!map) return;
    const l = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!handlers.current.disabled && e.latLng) handlers.current.onGuess({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    });
    return () => l.remove();
  }, [map]);

  useEffect(() => {
    map?.setOptions({ zoomControl: !compact });
  }, [map, compact]);

  useEffect(() => {
    if (!map || !guess) return;
    const pin = makePin(guess, 'guess', { zIndex: 5 });
    pin.setMap(map);
    return () => pin.setMap(null);
  }, [map, guess]);

  // Until a pin is placed, keep the whole play area framed as the panel grows, shrinks or un-hides.
  const hasGuess = useRef(!!guess);
  hasGuess.current = !!guess;
  useRefit(map, ref, () => !hasGuess.current && map!.fitBounds(boundsLiteral(area.bounds), 8), [area]);

  return <div ref={ref} className="gmap" />;
}

interface ResultMapProps {
  area: PlayArea;
  actual: LatLng;
  guess: LatLng | null;
  view: ResultView;
  distanceLabel: string | null;
  onFail: () => void;
}

/** Keeps both pins clear of the floating view toggle, status panel and India inset. */
const revealPadding = (node: HTMLElement): google.maps.Padding =>
  node.clientWidth > 900 ? { top: 90, left: 80, right: 220, bottom: 60 } : { top: 120, left: 40, right: 100, bottom: 80 };

export function GoogleResultMap({ area, actual, guess, view, distanceLabel, onFail }: ResultMapProps) {
  const [ref, map] = useGoogleMap(
    () => ({ gestureHandling: 'greedy', zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER } }),
    onFail,
  );
  useAreaOverlay(map, area, false);
  useEffect(
    () => (map ? drawVector(map, { actual, guess }, { highlighted: true, reveal: { distanceLabel } }) : undefined),
    [map, actual, guess, distanceLabel],
  );
  useRefit(
    map,
    ref,
    () => {
      const node = ref.current!;
      const pad = revealPadding(node);
      if (view === 'spot') {
        map!.setCenter(literal(actual));
        map!.setZoom(16);
        map!.panBy(((pad.left ?? 0) - (pad.right ?? 0)) / -2, ((pad.top ?? 0) - (pad.bottom ?? 0)) / -2);
      } else if (view === 'area') {
        map!.fitBounds(boundsLiteral(area.bounds), pad);
      } else {
        fitPoints(map!, guess ? [actual, guess] : [actual], pad, singlePointZoom(area));
      }
    },
    [actual.lat, actual.lng, guess?.lat, guess?.lng, area, view],
  );
  return <div ref={ref} className="gmap" />;
}

interface PlayersResultMapProps {
  area: PlayArea;
  actual: LatLng;
  pins: PlayerPin[];
  view: ResultView;
  onFail: () => void;
}

/** Multiplayer reveal: the correct location plus every player's pin in their seat colour. */
export function GooglePlayersResultMap({ area, actual, pins, view, onFail }: PlayersResultMapProps) {
  const [ref, map] = useGoogleMap(
    () => ({ gestureHandling: 'greedy', zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER } }),
    onFail,
  );
  useAreaOverlay(map, area, false);
  const pinsKey = pins.map((p) => `${p.point.lat},${p.point.lng},${p.color},${p.caption}`).join('|');
  useEffect(() => {
    if (!map) return;
    const layers: { setMap(m: google.maps.Map | null): void }[] = [];
    pins.forEach((p, i) => {
      layers.push(dashedLine(map, p.point, actual, 2.5, 0.9, undefined, p.color));
      layers.push(makePin(p.point, 'guess', { label: p.label, caption: p.caption, color: p.color, zIndex: 1 + i }));
    });
    layers.push(makePin(actual, 'actual', { caption: 'Correct location', pulse: true, zIndex: 10 }));
    layers.forEach((l) => l.setMap(map));
    return () => layers.forEach((l) => l.setMap(null));
  }, [map, actual.lat, actual.lng, pinsKey]);
  useRefit(
    map,
    ref,
    () => {
      const base = revealPadding(ref.current!);
      // The live scoreboard sits top-right, so keep pins and captions below it.
      const pad = { ...base, top: (base.top ?? 0) + 40 };
      if (view === 'spot') {
        map!.setCenter(literal(actual));
        map!.setZoom(16);
      } else if (view === 'area') {
        map!.fitBounds(boundsLiteral(area.bounds), pad);
      } else {
        fitPoints(map!, [actual, ...pins.map((p) => p.point)], pad, singlePointZoom(area));
      }
    },
    [actual.lat, actual.lng, pinsKey, area, view],
  );
  return <div ref={ref} className="gmap" />;
}

interface SummaryMapProps {
  area: PlayArea;
  vectors: Vector[];
  selected: number | null;
  onSelect: (i: number) => void;
  onFail: () => void;
}

export function GoogleSummaryMap({ area, vectors, selected, onSelect, onFail }: SummaryMapProps) {
  const [ref, map] = useGoogleMap(
    () => ({ gestureHandling: 'cooperative', zoomControl: true, zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM } }),
    onFail,
  );
  useAreaOverlay(map, area, false);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    if (!map) return;
    const clear = vectors.map((v, i) =>
      drawVector(map, v, { highlighted: selected === i, dimmed: selected != null && selected !== i, onSelect: () => select.current(i) }),
    );
    return () => clear.forEach((c) => c());
  }, [map, vectors, selected]);
  const focus =
    selected != null && vectors[selected]
      ? [vectors[selected].actual, ...(vectors[selected].guess ? [vectors[selected].guess!] : [])]
      : vectors.flatMap((v) => (v.guess ? [v.actual, v.guess] : [v.actual]));
  const focusKey = focus.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|');
  useRefit(map, ref, () => fitPoints(map!, focus, { top: 60, left: 60, right: 60, bottom: 60 }, singlePointZoom(area)), [focusKey, area]);
  return <div ref={ref} className="gmap" />;
}
