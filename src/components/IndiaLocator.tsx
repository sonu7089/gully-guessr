import { useEffect, useState } from 'react';
import { INDIA_BOUNDARY, type Ring } from '../data/indiaBoundary';
import { loadStateShapes } from '../engine/playArea';
import type { LatLng, StateCode } from '../engine/types';

const WEST = 68;
const EAST = 97.6;
const NORTH = 37.2;
const SOUTH = 6.4;
const KX = Math.cos((22 * Math.PI) / 180) * 10;
const KY = 10;
const VIEW_W = (EAST - WEST) * KX;
const VIEW_H = (NORTH - SOUTH) * KY;

const project = (p: LatLng): [number, number] => [(p.lng - WEST) * KX, (NORTH - p.lat) * KY];

function ringsToPath(rings: ReadonlyArray<Ring>): string {
  return rings
    .map((ring) => ring.map(([lng, lat], i) => `${i ? 'L' : 'M'}${((lng - WEST) * KX).toFixed(1)} ${((NORTH - lat) * KY).toFixed(1)}`).join('') + 'Z')
    .join('');
}

const INDIA_PATH = ringsToPath(INDIA_BOUNDARY);

interface IndiaLocatorProps {
  actual?: LatLng | null;
  guess?: LatLng | null;
  /** State to highlight (the answer's state). */
  stateCode?: StateCode | null;
  /** Several states to highlight at once, e.g. a region. */
  states?: readonly StateCode[];
  /** Extra small markers, e.g. the metro cities. */
  dots?: readonly LatLng[];
  className?: string;
}

/** Tiny India outline with the answer (and guess) marked, so the reveal always answers "where in India?". */
export function IndiaLocator({ actual, guess, stateCode, states, dots, className = '' }: IndiaLocatorProps) {
  const codes = [...(stateCode ? [stateCode] : []), ...(states ?? [])];
  const key = codes.join(',');
  const [statePath, setStatePath] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    loadStateShapes().then(
      (shapes) => alive && setStatePath(ringsToPath(key.split(',').flatMap((c) => shapes[c as StateCode]?.rings ?? []))),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [key]);

  const a = actual ? project(actual) : null;
  const g = guess ? project(guess) : null;
  return (
    <svg className={`locator ${className}`.trim()} viewBox={`-8 -8 ${VIEW_W + 16} ${VIEW_H + 16}`} role="img" aria-label="Location on the map of India">
      <path d={INDIA_PATH} className="locator__land" />
      {key && statePath && <path d={statePath} className="locator__state" />}
      {dots?.map((d, i) => {
        const [x, y] = project(d);
        return <circle key={i} cx={x} cy={y} r={7} className="locator__dot" />;
      })}
      {a && g && <line x1={g[0]} y1={g[1]} x2={a[0]} y2={a[1]} className="locator__line" />}
      {g && <circle cx={g[0]} cy={g[1]} r={6} className="locator__guess" />}
      {a && (
        <>
          <circle cx={a[0]} cy={a[1]} r={9} className="locator__pulse" />
          <circle cx={a[0]} cy={a[1]} r={7} className="locator__actual" />
        </>
      )}
    </svg>
  );
}
