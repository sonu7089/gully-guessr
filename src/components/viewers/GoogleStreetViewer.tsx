import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { streetViewLibrary } from '../../engine/googleMaps';
import type { ViewerHandle, ViewerProps } from './types';

/** Links Google injects into the panorama that open Maps at the current coordinates. */
const LOCATION_LINK_RE = /[?&](cbll|ll|q|viewpoint|pano|panoid)=|output=report|\/cbk\b|\/maps\/@|\/maps\?|maps\.google\./i;

/**
 * Google's logo and "Report a problem" link point at the panorama's location.
 * Keep the logo visible but make every link inert, and drop text-only
 * location links (the report link) since they are useless without the href.
 */
function scrubLocationLinks(root: HTMLElement): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
    if (LOCATION_LINK_RE.test(a.href) && !a.querySelector('img')) a.style.display = 'none';
    a.removeAttribute('href');
    a.tabIndex = -1;
  });
  // Navigation arrows are labelled "Go West, <road name>" even with road labels hidden.
  root.querySelectorAll<Element>('[aria-label^="Go "]').forEach((el) => {
    const label = el.getAttribute('aria-label')!;
    const comma = label.indexOf(',');
    if (comma > 0) el.setAttribute('aria-label', label.slice(0, comma));
  });
}

/** Live Google Street View with labels/addresses hidden and ruleset-driven controls. */
export const GoogleStreetViewer = forwardRef<ViewerHandle, ViewerProps>(function GoogleStreetViewer({ scene, ruleset, onHeading, onReady, onError }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const pano = useRef<google.maps.StreetViewPanorama | null>(null);
  const callbacks = useRef({ onHeading, onReady, onError });
  callbacks.current = { onHeading, onReady, onError };

  useEffect(() => {
    let cancelled = false;
    let ready = false;
    const listeners: google.maps.MapsEventListener[] = [];
    const root = container.current;
    const observer = root ? new MutationObserver(() => scrubLocationLinks(root)) : null;
    if (root) observer?.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'aria-label'] });
    (async () => {
      try {
        const { StreetViewPanorama, StreetViewStatus } = await streetViewLibrary();
        if (cancelled || !root) return;
        const moving = ruleset === 'standard';
        const locked = ruleset === 'nmpz';
        const p = new StreetViewPanorama(root, {
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
        if (!moving && scene.panoId) {
          // Hiding the arrows doesn't stop keyboard movement, so pin the pano for No Move / NMPZ.
          const startPano = scene.panoId;
          listeners.push(p.addListener('pano_changed', () => p.getPano() !== startPano && p.setPano(startPano)));
        }
        listeners.push(
          p.addListener('status_changed', () => {
            if (p.getStatus() === StreetViewStatus.OK) {
              ready = true;
              callbacks.current.onReady();
            } else if (!ready) {
              // A broken link mid-walk must not swap the round; only the starting pano can fail it.
              callbacks.current.onError();
            }
          }),
        );
        callbacks.current.onHeading(scene.heading);
      } catch {
        callbacks.current.onError();
      }
    })();
    return () => {
      cancelled = true;
      observer?.disconnect();
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
