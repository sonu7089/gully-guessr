import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { streetViewLibrary } from '../../engine/googleMaps';
import type { ViewerHandle, ViewerProps } from './types';

/** Live Google Street View with labels/addresses hidden and ruleset-driven controls. */
export const GoogleStreetViewer = forwardRef<ViewerHandle, ViewerProps>(function GoogleStreetViewer({ scene, ruleset, onHeading, onReady, onError }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const pano = useRef<google.maps.StreetViewPanorama | null>(null);
  const callbacks = useRef({ onHeading, onReady, onError });
  callbacks.current = { onHeading, onReady, onError };

  useEffect(() => {
    let cancelled = false;
    const listeners: google.maps.MapsEventListener[] = [];
    (async () => {
      try {
        const { StreetViewPanorama, StreetViewStatus } = await streetViewLibrary();
        if (cancelled || !container.current) return;
        const moving = ruleset === 'standard';
        const locked = ruleset === 'nmpz';
        const p = new StreetViewPanorama(container.current, {
          pano: scene.panoId,
          pov: { heading: scene.heading ?? 0, pitch: 0 },
          zoom: 0,
          addressControl: false,
          showRoadLabels: false,
          linksControl: moving,
          clickToGo: moving,
          disableDoubleClickZoom: !moving,
          panControl: false,
          zoomControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
          enableCloseButton: false,
          scrollwheel: !locked,
          imageDateControl: false,
          disableDefaultUI: true,
        });
        pano.current = p;
        listeners.push(p.addListener('pov_changed', () => callbacks.current.onHeading(p.getPov().heading)));
        listeners.push(
          p.addListener('status_changed', () => {
            if (p.getStatus() === StreetViewStatus.OK) callbacks.current.onReady();
            else callbacks.current.onError();
          }),
        );
        callbacks.current.onHeading(scene.heading);
      } catch {
        callbacks.current.onError();
      }
    })();
    return () => {
      cancelled = true;
      listeners.forEach((l) => l.remove());
      pano.current?.setVisible(false);
      pano.current = null;
    };
  }, [scene.id, scene.panoId, scene.heading, ruleset]);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      const p = pano.current;
      if (!p) return;
      if (scene.panoId && p.getPano() !== scene.panoId) p.setPano(scene.panoId);
      p.setPov({ heading: scene.heading ?? 0, pitch: 0 });
      p.setZoom(0);
    },
    zoomIn: () => {
      const p = pano.current;
      if (p && ruleset !== 'nmpz') p.setZoom(Math.min(4, p.getZoom() + 1));
    },
    zoomOut: () => {
      const p = pano.current;
      if (p && ruleset !== 'nmpz') p.setZoom(Math.max(0, p.getZoom() - 1));
    },
  }), [scene.panoId, scene.heading, ruleset]);

  return <div ref={container} className="viewer__surface" role="img" aria-label="Street View of the mystery location" />;
});
