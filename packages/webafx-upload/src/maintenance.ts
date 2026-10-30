import type { UploadFinalizer } from './finalizer.js';
import type { UploadLogger, UploadStore } from './types.js';

/** Maintenance policy for expired session records. */
export interface UploadMaintenanceOptions {
  /** Days to keep an expired record before deleting it; defaults to 30. */
  expiredRecordRetentionDays?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Expire sessions, remove their files, and purge old expired records. */
export class UploadMaintenance {
  public constructor(
    private readonly store: UploadStore,
    private readonly finalizer: UploadFinalizer,
    private readonly logger?: UploadLogger,
    private readonly options: UploadMaintenanceOptions = {},
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

    let purged = 0;
    const retentionDays = Math.max(0, this.options.expiredRecordRetentionDays ?? 30);
    const cutoff = new Date(now.getTime() - retentionDays * DAY_MS);
    const purgeable = this.store.listPurgeable ? await this.store.listPurgeable(cutoff) : [];
    for (const session of purgeable) {
      try {
        await this.store.delete(session.id);
        purged += 1;
      } catch (error) {
        await this.logger?.error('Expired upload record deletion failed', {
          sessionId: session.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (removed > 0 || purged > 0) {
      await this.logger?.info('Upload cleanup removed sessions', { removed, purged });
    }
    return removed;
  }
}
