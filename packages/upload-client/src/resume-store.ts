import type { UploadResumeStore } from './types.js';

/** In-memory resume store for tests and non-browser hosts. */
export class MemoryResumeStore implements UploadResumeStore {
  private readonly values = new Map<string, string>();

  public get(key: string): string | undefined {
    return this.values.get(key);
  }

  public set(key: string, value: string): void {
    this.values.set(key, value);
  }

  public delete(key: string): void {
    this.values.delete(key);
  }
}

/** Browser resume store backed by localStorage. */
export class LocalStorageResumeStore implements UploadResumeStore {
  public constructor(private readonly storage: Storage = globalThis.localStorage) {}

  public get(key: string): string | undefined {
    return this.storage.getItem(key) ?? undefined;
  }

  public set(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  public delete(key: string): void {
    this.storage.removeItem(key);
  }
}
