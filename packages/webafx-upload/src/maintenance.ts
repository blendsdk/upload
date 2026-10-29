import type { UploadFinalizer } from './finalizer.js';
import type { UploadLogger, UploadStore } from './types.js';

/** Remove expired sessions and their files. */
export class UploadMaintenance {
  public constructor(
    private readonly store: UploadStore,
    private readonly finalizer: UploadFinalizer,
    private readonly logger?: UploadLogger,
  ) {}

  public async cleanup(now = new Date()): Promise<number> {
    const expired = await this.store.listExpired(now);
    let removed = 0;
    for (const session of expired) {
      try {
        await this.finalizer.expire(session.id);
        removed += 1;
      } catch (error) {
        await this.logger?.error('Upload expiry failed', {
          sessionId: session.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (removed > 0) {
      await this.logger?.info('Upload cleanup removed sessions', { removed });
    }
    return removed;
  }
}
