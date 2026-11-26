import { CancelMapillaryError, Viewer, type ViewerBearingEvent } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { MAPILLARY_TOKEN } from '../../engine/imageryProviders';
import type { ViewerHandle, ViewerProps } from './types';

const MAX_ZOOM = 3;

/**
 * Navigable Mapillary street-level viewer. Attribution is disabled during play
 * because it links to mapillary.com at the image's coordinates; the photographer
 * is credited on the reveal screen instead.
 */
export const MapillaryViewer = forwardRef<ViewerHandle, ViewerProps>(function MapillaryViewer({ scene, ruleset, onHeading, onReady, onError }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const callbacks = useRef({ onHeading, onReady, onError });
  callbacks.current = { onHeading, onReady, onError };

  useEffect(() => {
    if (!container.current) return;
    const moving = ruleset === 'standard';
    const locked = ruleset === 'nmpz';
    let ready = false;
    const v = new Viewer({
      accessToken: MAPILLARY_TOKEN,
      container: container.current,
      component: {
        attribution: false,
        bearing: false,
        cover: false,
        zoom: false,
        direction: moving,
        sequence: moving,
        // Space and +/- are the game's own shortcuts.
        keyboard: moving ? { keyPlay: false, keyZoom: false } : false,
        pointer: !locked,
      },
    });
    viewer.current = v;
    const onBearing = (e: ViewerBearingEvent) => callbacks.current.onHeading(e.bearing);
    v.on('bearing', onBearing);
    v.moveTo(scene.id).then(
      () => {
        ready = true;
        callbacks.current.onReady();
      },
      (err) => {
        if (!ready && !(err instanceof CancelMapillaryError)) callbacks.current.onError();
      },
    );
    return () => {
      v.off('bearing', onBearing);
      viewer.current = null;
      v.remove();
    };
  }, [scene.id, ruleset]);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      const v = viewer.current;
      if (!v) return;
      v.moveTo(scene.id).catch(() => undefined);
      v.setCenter([0.5, 0.5]);
      v.setZoom(0);
    },
    zoomIn: () => {
      const v = viewer.current;
      if (v && ruleset !== 'nmpz') v.getZoom().then((z) => v.setZoom(Math.min(MAX_ZOOM, z + 1)));
    },
    zoomOut: () => {
      const v = viewer.current;
      if (v && ruleset !== 'nmpz') v.getZoom().then((z) => v.setZoom(Math.max(0, z - 1)));
    },
  }), [scene.id, ruleset]);

  return <div ref={container} className="viewer__surface" role="img" aria-label="Street-level view of the mystery location" />;
});
