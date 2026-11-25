import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ViewerHandle, ViewerProps } from './types';

const MAX_ZOOM = 4;

interface View {
  zoom: number;
  x: number;
  y: number;
}

/** Flat photograph viewer with cover-fit, drag-to-pan and wheel/pinch zoom. */
export const PhotoViewer = forwardRef<ViewerHandle, ViewerProps>(function PhotoViewer({ scene, ruleset, onHeading, onReady, onError }, ref) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [failed, setFailed] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const interactive = ruleset !== 'nmpz';

  useEffect(() => onHeading(null), [onHeading, scene.id]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const baseScale = natural && box.w ? Math.max(box.w / natural.w, box.h / natural.h) : 1;

  const clamp = useCallback(
    (v: View): View => {
      if (!natural) return v;
      const s = baseScale * v.zoom;
      const minX = box.w - natural.w * s;
      const minY = box.h - natural.h * s;
      return { zoom: v.zoom, x: Math.min(0, Math.max(minX, v.x)), y: Math.min(0, Math.max(minY, v.y)) };
    },
    [natural, baseScale, box.w, box.h],
  );

  const centred = useCallback((): View => {
    if (!natural) return { zoom: 1, x: 0, y: 0 };
    return clamp({ zoom: 1, x: (box.w - natural.w * baseScale) / 2, y: (box.h - natural.h * baseScale) / 2 });
  }, [natural, box.w, box.h, baseScale, clamp]);

  useEffect(() => {
    setView(centred());
  }, [centred]);

  const zoomAt = useCallback(
    (factor: number, cx = box.w / 2, cy = box.h / 2) => {
      setView((v) => {
        const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom * factor));
        const k = zoom / v.zoom;
        return clamp({ zoom, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
      });
    },
    [box.w, box.h, clamp],
  );

  useImperativeHandle(
    ref,
    () => ({
      resetView: () => setView(centred()),
      zoomIn: () => {
        if (interactive) zoomAt(1.4);
      },
      zoomOut: () => {
        if (interactive) zoomAt(1 / 1.4);
      },
    }),
    [centred, zoomAt, interactive],
  );

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, interactive]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
      setDragging(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current) {
        const rect = e.currentTarget.getBoundingClientRect();
        zoomAt(dist / pinch.current, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      }
      pinch.current = dist;
      drag.current = null;
      return;
    }
    const d = drag.current;
    if (d) setView((v) => clamp({ zoom: v.zoom, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
  };

  const endPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
      setDragging(false);
    }
  };

  const s = baseScale * view.zoom;
  return (
    <div
      ref={boxRef}
      className={`photo-viewer${interactive ? ' photo-viewer--pannable' : ''}${dragging ? ' photo-viewer--dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onDoubleClick={(e) => {
        if (!interactive) return;
        const rect = e.currentTarget.getBoundingClientRect();
        zoomAt(1.6, e.clientX - rect.left, e.clientY - rect.top);
      }}
      role="img"
      aria-label="Street-level photograph of the mystery location"
    >
      {!failed && (
        <img
          key={scene.id}
          src={scene.imageUrl}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
            onReady();
          }}
          onError={() => {
            setFailed(true);
            onError();
          }}
          style={{
            width: natural ? natural.w : undefined,
            height: natural ? natural.h : undefined,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${s})`,
            visibility: natural ? 'visible' : 'hidden',
          }}
        />
      )}
      {failed && <div className="photo-viewer__error eyebrow">Image unavailable</div>}
    </div>
  );
});
