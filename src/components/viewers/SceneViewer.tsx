import { forwardRef, lazy, Suspense } from 'react';
import { GoogleStreetViewer } from './GoogleStreetViewer';
import { PhotoViewer } from './PhotoViewer';
import type { ViewerHandle, ViewerProps } from './types';

// three.js is heavy; only load it when a 360° scene is shown.
const SphereViewer = lazy(() => import('./SphereViewer').then((m) => ({ default: m.SphereViewer })));
const MapillaryViewer = lazy(() => import('./MapillaryViewer').then((m) => ({ default: m.MapillaryViewer })));

/** Chooses the right renderer for the scene and enforces NMPZ with an input lock. */
export const SceneViewer = forwardRef<ViewerHandle, ViewerProps>(function SceneViewer(props, ref) {
  const { scene, ruleset } = props;
  return (
    <div className="viewer">
      {scene.kind === 'google' && <GoogleStreetViewer ref={ref} {...props} />}
      {scene.kind === 'mapillary' && (
        <Suspense fallback={null}>
          <MapillaryViewer ref={ref} {...props} />
        </Suspense>
      )}
      {scene.kind === 'equirect' && (
        <Suspense fallback={null}>
          <SphereViewer ref={ref} {...props} />
        </Suspense>
      )}
      {scene.kind === 'photo' && <PhotoViewer ref={ref} {...props} />}
      {ruleset === 'nmpz' && <div className="viewer__lock" aria-hidden="true" />}
    </div>
  );
});

export type { ViewerHandle } from './types';
