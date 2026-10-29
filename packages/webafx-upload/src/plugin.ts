import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import type { PluginDefinition } from 'blendsdk/webafx';
import { UploadFileController } from './file-controller.js';
import { UploadSessionController } from './controller.js';
import { UploadFinalizer } from './finalizer.js';
import { UploadMaintenance } from './maintenance.js';
import { SharpImageProcessor } from './processors.js';
import { MemoryUploadStore } from './store.js';
import { LocalUploadStorage } from './storage.js';
import { createTusServer } from './tus.js';
import type {
  UploadLogger,
  UploadProcessor,
  UploadServerOptions,
  UploadSessionRecord,
} from './types.js';

function normalizeBasePath(value: string): string {
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  return withSlash.replace(/\/+$/, '') || '/api/uploads';
}

/**
 * WebAFX v5 upload plugin.
 *
 * It registers the JSON session controller, mounts the tus byte endpoint
 * before the global CSRF middleware, and wires storage, finalization and
 * application callbacks. The plugin never owns application tables; domain
 * records are created in `onFinalized` or `onCommitted`.
 */
export function uploadPlugin(options: UploadServerOptions): PluginDefinition {
  if (!options.tokenSecret || options.tokenSecret.length < 16) {
    throw new Error('uploadPlugin requires a token secret of at least 16 characters.');
  }
  const basePath = normalizeBasePath(options.basePath ?? '/api/uploads');
  const storage =
    options.storage ??
    new LocalUploadStorage(options.storageRoot ?? path.resolve(process.cwd(), 'var', 'uploads'));
  const store = options.store ?? new MemoryUploadStore();
  const processors: Record<string, UploadProcessor> = Object.assign(
    Object.create(null) as Record<string, UploadProcessor>,
    options.processors ?? {},
  );

  for (const policy of Object.values(options.policies)) {
    if (
      !processors[policy.purpose] &&
      policy.constraints.accept.some((type) => type.startsWith('image/'))
    ) {
      processors[policy.purpose] = new SharpImageProcessor(options.heicDecoder);
    }
  }

  return {
    name: 'blendsdk-upload',
    priority: 40,
    factory: async ({ app, logger }) => {
      const uploadLogger = (options.logger ?? logger) as UploadLogger;
      await mkdir(storage.tusDirectory, { recursive: true, mode: 0o700 });
      const { server: tusServer, datastore } = createTusServer({
        basePath,
        store,
        storageDirectory: storage.tusDirectory,
        tokenSecret: options.tokenSecret,
        maxSize: options.maxTusSize,
        expirationMs:
          Math.max(
            options.sessionTtlSeconds ?? 24 * 60 * 60,
            options.stagedTtlSeconds ?? 7 * 24 * 60 * 60,
          ) * 1000,
        locker: options.tusLocker,
        logger: uploadLogger,
      });

      const finalizer = new UploadFinalizer({
        store,
        storage,
        policies: options.policies,
        processors,
        logger: uploadLogger,
        onFinalized: options.onFinalized,
        onCommitted: options.onCommitted,
        onDeleted: options.onDeleted,
        scanner: options.scanner,
        removeUpload: async (session: UploadSessionRecord) => {
          if (!session.tusUploadId) {
            return;
          }
          try {
            await datastore.remove(session.tusUploadId);
          } catch {
            // The tus file may already have been expired or removed.
          }
        },
        resolveUploadPath: async (session: UploadSessionRecord) => {
          if (!session.tusUploadId) {
            throw new Error(`Upload session ${session.id} has no tus upload id.`);
          }
          const upload = await datastore.getUpload(session.tusUploadId);
          if (!upload.storage || upload.storage.type !== 'file') {
            throw new Error(`Upload session ${session.id} has no local storage path.`);
          }
          return upload.storage.path;
        },
      });

      app.registerService({
        name: 'upload.options',
        type: 'singleton',
        factory: () => ({ ...options, basePath }),
      });
      app.registerService({
        name: 'upload.store',
        type: 'singleton',
        factory: () => store,
      });
      app.registerService({
        name: 'upload.storage',
        type: 'singleton',
        factory: () => storage,
      });
      app.registerService({
        name: 'upload.finalizer',
        type: 'singleton',
        factory: () => finalizer,
      });

      app.registerController(basePath, UploadSessionController);
      app.registerController(`${basePath}/files`, UploadFileController);

      const maintenance = new UploadMaintenance(store, finalizer, uploadLogger);
      const cleanupIntervalMs = options.cleanupIntervalMs ?? 15 * 60 * 1000;
      let cleaning = false;
      const runCleanup = async (): Promise<void> => {
        if (cleaning) {
          return;
        }
        cleaning = true;
        try {
          await maintenance.cleanup();
          await tusServer.cleanUpExpiredUploads();
        } catch (error) {
          await uploadLogger.error('Upload cleanup failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        } finally {
          cleaning = false;
        }
      };
      const cleanupTimer =
        cleanupIntervalMs > 0 ? setInterval(() => void runCleanup(), cleanupIntervalMs) : undefined;
      cleanupTimer?.unref?.();

      const router = express.Router();
      router.use((req, res) => {
        void tusServer.handle(req, res);
      });
      app.express.use(`${basePath}/tus`, router);

      await uploadLogger.info('BlendSDK upload plugin installed', { basePath });
      return {
        health: async () => {
          try {
            await storage.ensureParent(path.join(storage.tusDirectory, '.health'));
            return true;
          } catch {
            return false;
          }
        },
        shutdown: async () => {
          if (cleanupTimer) {
            clearInterval(cleanupTimer);
          }
        },
      };
    },
  };
}
