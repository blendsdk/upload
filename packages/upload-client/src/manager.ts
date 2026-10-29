import {
  UploadError,
  formatBytes,
  toUploadError,
  validateBatchCount,
  validateFileDescriptor,
  type CreateUploadSessionResponse,
  type UploadErrorDetail,
  type UploadItemState,
  type UploadManagerState,
  type UploadPolicyResponse,
  type UploadResult,
  type UploadSession,
} from '@blendsdk/upload-core';
import {
  fingerprint,
  toFileDescriptor,
  type UploadManagerOptions,
  type UploadResumeStore,
  type UploadTransport,
  type UploadTransportHandle,
} from './types.js';
import { MemoryResumeStore } from './resume-store.js';
import { TusTransport } from './transport.js';

interface InternalItem {
  id: string;
  file: File;
  resumeKey: string;
  state: UploadItemState;
  session?: CreateUploadSessionResponse;
  handle?: UploadTransportHandle;
  transportComplete: boolean;
}

const POLL_INTERVAL_MS = 500;
const POLL_ATTEMPTS = 60;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function errorDetail(error: unknown): UploadErrorDetail {
  return toUploadError(error, 'internal_error').toDetail();
}

/**
 * Queue-based upload manager.
 *
 * The manager is deliberately independent of React. The UI subscribes through
 * `useSyncExternalStore`; tests can drive it with a fake client and transport.
 */
export class UploadManager {
  private readonly items: InternalItem[] = [];
  private readonly listeners = new Set<() => void>();
  private readonly client: UploadManagerOptions['client'];
  private readonly purpose: string;
  private readonly context: Record<string, unknown> | undefined;
  private readonly scope: string | undefined;
  private readonly concurrency: number;
  private readonly autoStart: boolean;
  private readonly transport: UploadTransport;
  private readonly resumeStore: UploadResumeStore;
  private readonly onChange?: UploadManagerOptions['onChange'];
  private policyPromise: Promise<UploadPolicyResponse>;
  private snapshot: UploadManagerState;
  private activeCount = 0;
  private running = false;
  private idleResolvers: Array<() => void> = [];

  public constructor(options: UploadManagerOptions) {
    this.client = options.client;
    this.purpose = options.purpose;
    this.context = options.context;
    this.scope = options.scope;
    this.concurrency = Math.max(1, options.concurrency ?? 2);
    this.autoStart = options.autoStart ?? false;
    this.transport = options.transport ?? new TusTransport();
    this.resumeStore = options.resumeStore ?? new MemoryResumeStore();
    this.onChange = options.onChange;
    this.policyPromise = options.policy
      ? Promise.resolve(options.policy)
      : this.client.getPolicy(this.purpose);
    this.snapshot = this.buildSnapshot();
    this.policyPromise.then(
      () => {
        // Policy is consumed by addFiles/start; the promise carries the value.
      },
      () => {
        // The failure is surfaced when the first file is added or started.
      },
    );
  }

  /** Subscribe to state changes. */
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Return the latest immutable snapshot. */
  public getState = (): UploadManagerState => this.snapshot;

  /** Resolve the policy and add browser files to the queue. */
  public async addFiles(files: File[]): Promise<void> {
    let policy: UploadPolicyResponse;
    try {
      policy = await this.policyPromise;
    } catch (error) {
      const detail = errorDetail(error);
      for (const file of files) {
        this.addItem(file, detail);
      }
      this.emit();
      return;
    }

    const countIssue = validateBatchCount(this.items.length + files.length, policy.constraints);
    for (const file of files) {
      const descriptor = toFileDescriptor(file);
      const issues = validateFileDescriptor(descriptor, policy.constraints);
      if (issues.length > 0) {
        const issue = issues[0]!;
        this.addItem(file, {
          code: issue.code,
          message: issue.message,
          retryability: 'terminal',
        });
        continue;
      }
      if (countIssue.length > 0 && this.items.length >= policy.constraints.maxFiles) {
        this.addItem(file, {
          code: countIssue[0]!.code,
          message: countIssue[0]!.message,
          retryability: 'terminal',
        });
        continue;
      }
      this.addItem(file);
    }

    this.emit();
    if (this.autoStart) {
      void this.start();
    }
  }

  /** Start queued work. Resolves when the queue becomes idle. */
  public start(): Promise<void> {
    if (this.running) {
      return new Promise((resolve) => this.idleResolvers.push(resolve));
    }
    this.running = true;
    const promise = new Promise<void>((resolve) => this.idleResolvers.push(resolve));
    this.pump();
    return promise;
  }

  /** Pause one active item. */
  public pause(id: string): void {
    const item = this.find(id);
    if (!item || !item.handle) {
      return;
    }
    item.handle.pause();
    this.patch(id, { status: 'paused' });
  }

  /** Resume one paused item. */
  public resume(id: string): void {
    const item = this.find(id);
    if (!item || item.state.status !== 'paused') {
      return;
    }
    this.patch(id, { status: 'queued' });
    void this.start();
  }

  /** Retry one failed item. */
  public retry(id: string): void {
    const item = this.find(id);
    if (!item || item.state.status !== 'failed') {
      return;
    }
    item.transportComplete = false;
    this.patch(id, {
      status: 'queued',
      error: undefined,
      attempt: item.state.attempt + 1,
    });
    void this.start();
  }

  /** Cancel one item and delete its server session. */
  public async cancel(id: string): Promise<void> {
    const item = this.find(id);
    if (!item) {
      return;
    }
    item.handle?.cancel();
    if (item.session) {
      try {
        await this.client.cancel(item.session.id, item.session.token);
      } catch {
        // Cancellation is best effort; the server cleanup also expires it.
      }
    }
    this.patch(id, { status: 'canceled', error: undefined });
  }

  /** Remove one item from the list. Active items are cancelled first. */
  public async remove(id: string): Promise<void> {
    const item = this.find(id);
    if (!item) {
      return;
    }
    if (item.handle) {
      await this.cancel(id);
    }
    const index = this.items.indexOf(item);
    if (index >= 0) {
      this.items.splice(index, 1);
      this.emit();
    }
  }

  /** Pause every active item. */
  public pauseAll(): void {
    for (const item of this.items) {
      if (item.handle) {
        this.pause(item.id);
      }
    }
  }

  /** Cancel every active item. */
  public async cancelAll(): Promise<void> {
    await Promise.all(this.items.filter((item) => item.handle).map((item) => this.cancel(item.id)));
  }

  /** Commit all ready sessions, or a selected subset. */
  public async commit(ids?: string[]): Promise<UploadSession[]> {
    const selected = this.items.filter(
      (item) =>
        item.session &&
        item.state.status === 'ready' &&
        (!ids || ids.includes(item.id) || ids.includes(item.session.id)),
    );
    if (selected.length === 0) {
      return [];
    }
    const sessions = await this.client.commit({
      ids: selected.map((item) => item.session!.id),
      context: this.context,
    });
    this.emit();
    return sessions;
  }

  private addItem(file: File, error?: UploadErrorDetail): void {
    const descriptor = toFileDescriptor(file);
    const resumeKey = `${this.purpose}:${fingerprint(descriptor).name}:${descriptor.size}:${descriptor.lastModified ?? 0}`;
    const existingKey = this.resumeStore.get(resumeKey);
    const state: UploadItemState = {
      id: newId(),
      file: descriptor,
      status: error ? 'failed' : 'queued',
      bytesUploaded: 0,
      bytesTotal: descriptor.size,
      progress: 0,
      attempt: 0,
      ...(error ? { error } : {}),
    };
    this.items.push({
      id: state.id,
      file,
      resumeKey: existingKey ?? resumeKey,
      state,
      transportComplete: false,
    });
  }

  private find(id: string): InternalItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  private patch(id: string, patch: Partial<UploadItemState>): void {
    const item = this.find(id);
    if (!item) {
      return;
    }
    item.state = { ...item.state, ...patch };
    this.emit();
  }

  private pump(): void {
    while (this.running && this.activeCount < this.concurrency) {
      const item = this.items.find((candidate) => candidate.state.status === 'queued');
      if (!item) {
        break;
      }
      this.activeCount += 1;
      void this.processItem(item).finally(() => {
        this.activeCount -= 1;
        this.pump();
      });
    }

    if (this.activeCount === 0 && !this.items.some((item) => item.state.status === 'queued')) {
      this.running = false;
      const resolvers = this.idleResolvers;
      this.idleResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
    this.emit();
  }

  private async processItem(item: InternalItem): Promise<void> {
    try {
      if (!item.session) {
        this.patch(item.id, { status: 'creating' });
        item.session = await this.client.createSession({
          purpose: this.purpose,
          file: item.state.file,
          ...(this.scope ? { scope: this.scope } : {}),
          ...(this.context ? { context: this.context } : {}),
          resumeKey: item.resumeKey,
        });
        this.resumeStore.set(item.resumeKey, item.session.id);
      }

      if (!item.transportComplete) {
        this.patch(item.id, { status: 'uploading', sessionId: item.session.id });
        item.handle = this.transport.start({
          file: item.file,
          session: {
            id: item.session.id,
            purpose: this.purpose,
            token: item.session.token,
            tusEndpoint: item.session.tusEndpoint,
            chunkSize: item.session.chunkSize,
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            this.patch(item.id, {
              bytesUploaded,
              bytesTotal,
              progress: bytesTotal > 0 ? bytesUploaded / bytesTotal : 0,
            });
          },
        });
        await item.handle.promise;
        item.handle = undefined;
        if (item.state.status === 'canceled') {
          return;
        }
        item.transportComplete = true;
      }

      this.patch(item.id, { status: 'processing', progress: 1 });
      let session = await this.client.finalize(item.session.id, item.session.token);
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        if (session.status !== 'processing' && session.status !== 'uploaded') {
          break;
        }
        await sleep(POLL_INTERVAL_MS);
        session = await this.client.getSession(item.session.id, item.session.token);
      }

      if (
        session.status === 'ready' ||
        session.status === 'staged' ||
        session.status === 'committed'
      ) {
        this.resumeStore.delete(item.resumeKey);
        this.patch(item.id, {
          status: 'ready',
          result: session.result as UploadResult | undefined,
          error: undefined,
        });
      } else if (session.status === 'failed') {
        this.patch(item.id, {
          status: 'failed',
          error: session.error ?? {
            code: 'processing_failed',
            message: 'The upload could not be processed.',
            retryability: 'retryable',
          },
        });
      } else {
        this.patch(item.id, {
          status: 'failed',
          error: {
            code: 'processing_failed',
            message: `The upload ended in status "${session.status}".`,
            retryability: 'retryable',
          },
        });
      }
    } catch (error) {
      if (error instanceof UploadError && error.code === 'canceled') {
        this.patch(item.id, { status: 'canceled' });
        return;
      }
      this.patch(item.id, { status: 'failed', error: errorDetail(error) });
    }
  }

  private emit(): void {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
    this.onChange?.(this.snapshot);
  }

  private buildSnapshot(): UploadManagerState {
    const items = this.items.map((item) => item.state);
    const uploadedBytes = items.reduce((total, item) => total + item.bytesUploaded, 0);
    const totalBytes = items.reduce((total, item) => total + item.bytesTotal, 0);
    return {
      items,
      isUploading: this.activeCount > 0 || items.some((item) => item.status === 'queued'),
      activeCount: this.activeCount,
      completedCount: items.filter((item) => item.status === 'ready').length,
      failedCount: items.filter((item) => item.status === 'failed').length,
      totalBytes,
      uploadedBytes,
    };
  }
}

/** Convenience factory. */
export function createUploadManager(options: UploadManagerOptions): UploadManager {
  return new UploadManager(options);
}

/** Describe a manager error in a UI-friendly form. */
export function describeUploadError(error: UploadErrorDetail): string {
  return `${error.message}${error.retryability === 'retryable' ? ' You can retry this upload.' : ''}`;
}

/** Human-readable progress for a state snapshot. */
export function describeProgress(state: UploadManagerState): string {
  return `${formatBytes(state.uploadedBytes)} of ${formatBytes(state.totalBytes)}`;
}
