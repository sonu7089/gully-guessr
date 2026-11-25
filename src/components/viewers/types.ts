import type { Scene } from '../../engine/imageryProviders';
import type { Ruleset } from '../../engine/types';

export interface ViewerHandle {
  resetView(): void;
  zoomIn(): void;
  zoomOut(): void;
}

export interface ViewerProps {
  scene: Scene;
  ruleset: Ruleset;
  /** Compass heading in degrees (0 = north), or null when unknown. */
  onHeading: (heading: number | null) => void;
  onReady: () => void;
  onError: () => void;
}
