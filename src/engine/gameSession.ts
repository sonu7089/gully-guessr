import { ROUNDS_PER_GAME } from '../config';
import type { ImageryProvider } from './imageryProviders';
import { prepareRound, type PreparedRound } from './roundPlanner';
import type { LatLng, RegionPack } from './types';

/**
 * Sequential, prefetching round queue. Round N+1 is prepared in the background
 * while Round N is played, always respecting the separation from earlier rounds.
 */
export class RoundQueue {
  private rounds: Promise<PreparedRound>[] = [];
  private locations: LatLng[] = [];
  private readonly controller = new AbortController();
  readonly sceneIds: Set<string>;
  readonly anchorIds: string[] = [];

  constructor(
    private readonly provider: ImageryProvider,
    private readonly pack: RegionPack,
    private readonly recentAnchorIds: readonly string[] = [],
    recentSceneIds: readonly string[] = [],
    private readonly total = ROUNDS_PER_GAME,
  ) {
    this.sceneIds = new Set(recentSceneIds);
  }

  get(index: number): Promise<PreparedRound> {
    for (let k = this.rounds.length; k <= index; k++) {
      const previous = k === 0 ? Promise.resolve() : this.rounds[k - 1].then(() => undefined, () => undefined);
      this.rounds[k] = previous.then(async () => {
        const round = await prepareRound({
          provider: this.provider,
          pack: this.pack,
          previous: [...this.locations],
          recentAnchorIds: [...this.recentAnchorIds, ...this.anchorIds],
          excludeSceneIds: this.sceneIds,
          signal: this.controller.signal,
        });
        this.locations.push(round.scene);
        this.sceneIds.add(round.scene.id);
        if (round.candidate) this.anchorIds.push(round.candidate.anchor.id);
        return round;
      });
    }
    return this.rounds[index];
  }

  prefetch(index: number): void {
    if (index < this.total && !this.controller.signal.aborted) this.get(index).catch(() => undefined);
  }

  dispose(): void {
    this.controller.abort();
  }
}
