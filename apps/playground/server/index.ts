import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { WebApplication } from 'blendsdk/webafx';
import { createDocumentPolicy, createImagePolicy } from '@blendsdk/upload-core';
import { uploadPlugin, type UploadStorage } from '@blendsdk/webafx-upload';
import { createS3UploadStorage } from '@blendsdk/webafx-upload/s3';

try {
  loadEnvFile();
} catch {
  // The playground also works with exported environment variables.
}

const port = Number(process.env.PORT ?? 3001);
const useS3 = process.env.PLAYGROUND_S3 === '1';
const dataRoot = path.resolve(process.cwd(), '.data');
const logLevels = ['DEBUG', 'ERROR', 'INFO', 'WARN'] as const;
type LogLevel = (typeof logLevels)[number];

function resolveLogLevel(value: string | undefined): LogLevel {
  return logLevels.find((level) => level === value) ?? 'INFO';
}

async function createStorage(): Promise<UploadStorage | undefined> {
  if (!useS3) {
    return undefined;
  }
  return createS3UploadStorage({
    bucket: process.env.S3_BUCKET ?? 'uploads-test',
    prefix: process.env.S3_PREFIX ?? 'playground',
    localRoot: path.join(dataRoot, 's3'),
    clientConfig: {
      endpoint: process.env.S3_ENDPOINT ?? 'http://127.0.0.1:9090',
      region: process.env.S3_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? 'test',
        secretAccessKey: process.env.S3_SECRET_KEY ?? 'test',
      },
    },
  });
}

const storage = await createStorage();
const app = new WebApplication({
  PORT: port,
  ENV_MODE: 'development',
  LOG_LEVEL: resolveLogLevel(process.env.LOG_LEVEL),
  BODY_LIMIT: '2mb',
});

app.registerService({
  name: 'user',
  type: 'per-request',
  factory: () => ({ id: 'playground-user' }),
});
app.use(
  uploadPlugin({
    tokenSecret: process.env.UPLOAD_TOKEN_SECRET ?? 'playground-token-secret-change-before-sharing',
    basePath: '/api/uploads',
    ...(storage ? { storage } : { storageRoot: path.join(dataRoot, 'uploads') }),
    policies: {
      'playground.image': createImagePolicy('playground.image'),
      'playground.document': createDocumentPolicy('playground.document'),
    },
    cleanupIntervalMs: 30_000,
    maxActiveSessions: 20,
    authorizeSession: () => ({ ownerId: 'playground-user', scope: 'playground' }),
    authorizeFile: () => true,
    onFinalized: ({ session, files }) => {
      console.info(`[playground] finalized ${session.purpose}: ${files.length} file(s)`);
    },
    onCommitted: ({ session, files }) => {
      console.info(`[playground] committed ${session.purpose}: ${files.length} file(s)`);
    },
  }),
);

await app.start();
console.info(`[playground] server listening on http://127.0.0.1:${port}`);
console.info(`[playground] storage: ${useS3 ? 'S3/S3Mock' : 'local filesystem'}`);
