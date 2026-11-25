import { Viewer } from '@photo-sphere-viewer/core';
import '@photo-sphere-viewer/core/index.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ViewerHandle, ViewerProps } from './types';

const DEFAULT_ZOOM = 30;
const toDeg = (r: number) => (r * 180) / Math.PI;
const norm = (d: number) => ((d % 360) + 360) % 360;

/** Equirectangular 360° viewer (Mapillary / Commons panoramas) via Photo Sphere Viewer. */
export const SphereViewer = forwardRef<ViewerHandle, ViewerProps>(function SphereViewer({ scene, ruleset, onHeading, onReady, onError }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const callbacks = useRef({ onHeading, onReady, onError });
  callbacks.current = { onHeading, onReady, onError };

  useEffect(() => {
    if (!container.current) return;
    const locked = ruleset === 'nmpz';
    const v = new Viewer({
      container: container.current,
      panorama: scene.imageUrl,
      navbar: false,
      loadingTxt: '',
      defaultZoomLvl: DEFAULT_ZOOM,
      mousewheel: !locked,
      mousemove: !locked,
      keyboard: false,
      touchmoveTwoFingers: false,
    });
    viewer.current = v;
    const base = scene.heading;
    const report = (yaw: number) => callbacks.current.onHeading(base == null ? null : norm(base + toDeg(yaw)));
    v.addEventListener(
      'ready',
      () => {
        report(v.getPosition().yaw);
        callbacks.current.onReady();
      },
      { once: true },
    );
    v.addEventListener('position-updated', ({ position }) => report(position.yaw));
    v.addEventListener('panorama-error', () => callbacks.current.onError());
    return () => {
      viewer.current = null;
      v.destroy();
    };
  }, [scene.id, scene.imageUrl, scene.heading, ruleset]);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      viewer.current?.rotate({ yaw: 0, pitch: 0 });
      viewer.current?.zoom(DEFAULT_ZOOM);
    },
    zoomIn: () => {
      if (ruleset !== 'nmpz') viewer.current?.zoomIn();
    },
    zoomOut: () => {
      if (ruleset !== 'nmpz') viewer.current?.zoomOut();
    },
  }), [ruleset]);

  return <div ref={container} className="viewer__surface" aria-label="360° panorama of the mystery location" role="img" />;
});
