import type { StoredUploadFile, UploadSession, UploadStatus } from '@blendsdk/upload-core';
import type { UploadFileRecord, UploadSessionRecord, UploadStore } from './types.js';

function cloneRecord(record: UploadSessionRecord): UploadSessionRecord {
  return {
    ...record,
    file: { ...record.file },
    constraints: { ...record.constraints, accept: [...record.constraints.accept] },
    context: { ...record.context },
    files: record.files.map((file) => ({ ...file })),
    ...(record.result
      ? { result: { ...record.result, files: record.result.files.map((file) => ({ ...file })) } }
      : {}),
  };
}

/** Convert a server record to the public API shape. */
export function toPublicSession(record: UploadSessionRecord): UploadSession {
  return {
    id: record.id,
    scope: record.scope,
    purpose: record.purpose,
    status: record.status,
    file: record.file,
    bytesUploaded: record.bytesUploaded,
    bytesTotal: record.bytesTotal,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    ...(record.completedAt ? { completedAt: record.completedAt } : {}),
    ...(record.error ? { error: record.error } : {}),
    ...(record.result
      ? {
          result: {
            ...record.result,
            files: record.result.files.map((file) => {
              const { storageKey: _storageKey, ...publicFile } = file as UploadFileRecord;
              return publicFile as StoredUploadFile;
            }),
          },
        }
      : {}),
  };
}

/** In-memory store for development, tests and single-process examples. */
export class MemoryUploadStore implements UploadStore {
  private readonly records = new Map<string, UploadSessionRecord>();

  public async create(record: UploadSessionRecord): Promise<void> {
    this.records.set(record.id, cloneRecord(record));
  }

  public async get(id: string): Promise<UploadSessionRecord | undefined> {
    const record = this.records.get(id);
    return record ? cloneRecord(record) : undefined;
  }

  public async update(
    id: string,
    patch: Partial<UploadSessionRecord>,
  ): Promise<UploadSessionRecord | undefined> {
    const current = this.records.get(id);
    if (!current) {
      return undefined;
    }
    const next = cloneRecord({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    } as UploadSessionRecord);
    this.records.set(id, next);
    return cloneRecord(next);
  }

  public async updateIfStatus(
    id: string,
    statuses: UploadStatus[],
    patch: Partial<UploadSessionRecord>,
  ): Promise<UploadSessionRecord | undefined> {
    const current = this.records.get(id);
    if (!current || !statuses.includes(current.status)) {
      return undefined;
    }
    return this.update(id, patch);
  }

  public async findByClientKey(
    scope: string | undefined,
    ownerId: string | undefined,
    clientKey: string,
  ): Promise<UploadSessionRecord | undefined> {
    for (const record of this.records.values()) {
      if (record.scope === scope && record.ownerId === ownerId && record.clientKey === clientKey) {
        return cloneRecord(record);
      }
    }
    return undefined;
  }

  public async countActive(
    scope: string | undefined,
    ownerId: string | undefined,
  ): Promise<number> {
    return [...this.records.values()].filter(
      (record) =>
        record.scope === scope &&
        record.ownerId === ownerId &&
        record.status !== 'committed' &&
        record.status !== 'canceled' &&
        record.status !== 'expired',
    ).length;
  }

  public async findFile(
    fileId: string,
  ): Promise<{ session: UploadSessionRecord; file: UploadFileRecord } | undefined> {
    for (const record of this.records.values()) {
      const file = record.files.find((candidate) => candidate.id === fileId);
      if (file) {
        return { session: cloneRecord(record), file: { ...file } };
      }
    }
    return undefined;
  }

  public async listExpired(now: Date): Promise<UploadSessionRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.status !== 'committed' &&
          record.status !== 'ready' &&
          record.status !== 'canceled' &&
          record.status !== 'expired' &&
          Date.parse(record.expiresAt) <= now.getTime(),
      )
      .map(cloneRecord);
  }

  public async listPurgeable(before: Date): Promise<UploadSessionRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) => record.status === 'expired' && Date.parse(record.expiresAt) <= before.getTime(),
      )
      .map(cloneRecord);
  }

  public async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}
