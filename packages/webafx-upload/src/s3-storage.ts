import { createReadStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { scopeHash } from './storage.js';
import type { UploadStorage } from './types.js';

type S3Sdk = typeof import('@aws-sdk/client-s3');

/** Options for the optional S3 final-storage adapter. */
export interface S3UploadStorageOptions {
  bucket: string;
  prefix?: string;
  clientConfig?: S3ClientConfig;
  /** Local directory for tus staging; defaults to a temp directory. */
  localRoot?: string;
}

export interface S3UploadStorageInternalOptions extends S3UploadStorageOptions {
  client: S3Client;
  sdk: S3Sdk;
}

function safeExtension(extension: string): string {
  const value = extension.toLowerCase().replace(/[^.a-z0-9]/g, '');
  return value.startsWith('.') ? value : `.${value}`;
}

function safeRole(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'original';
}

/**
 * S3-backed final storage.
 *
 * tus still writes to a local staging directory. The finalizer moves the
 * original and generated variants to the bucket through this adapter. The AWS
 * SDK is an optional peer and is loaded only by `createS3UploadStorage`.
 */
export class S3UploadStorage implements UploadStorage {
  public readonly tusDirectory: string;
  private readonly localRoot: string;
  private readonly prefix: string;

  public constructor(private readonly options: S3UploadStorageInternalOptions) {
    this.localRoot = path.resolve(options.localRoot ?? path.join(tmpdir(), 'blendsdk-upload-s3'));
    this.tusDirectory = path.join(this.localRoot, 'tus');
    this.prefix = (options.prefix ?? 'uploads').replace(/^\/+|\/+$/g, '');
  }

  public stagingPath(scope: string | undefined, sessionId: string, extension: string): string {
    return path.join(
      this.localRoot,
      'staging',
      scopeHash(scope),
      `${sessionId}${safeExtension(extension)}`,
    );
  }

  public finalPath(
    scope: string | undefined,
    fileId: string,
    role: string,
    extension: string,
  ): string {
    const key = [
      this.prefix,
      scopeHash(scope),
      'files',
      fileId,
      `${safeRole(role)}${safeExtension(extension)}`,
    ]
      .filter(Boolean)
      .join('/');
    return `s3://${this.options.bucket}/${key}`;
  }

  public async ensureParent(filePath: string): Promise<void> {
    if (!filePath.startsWith('s3://')) {
      await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    }
  }

  public async move(from: string, to: string): Promise<void> {
    if (!to.startsWith('s3://')) {
      await this.moveLocal(from, to);
      return;
    }
    const key = this.keyOf(to);
    const body = from.startsWith('s3://') ? await this.openS3Stream(from) : createReadStream(from);
    await this.options.client.send(
      new this.options.sdk.PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
      }),
    );
    if (from.startsWith('s3://')) {
      await this.delete(from);
    } else {
      await rm(from, { force: true });
    }
  }

  public async write(filePath: string, data: Uint8Array): Promise<void> {
    const key = this.keyOf(filePath);
    await this.options.client.send(
      new this.options.sdk.PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: Buffer.from(data),
      }),
    );
  }

  public async delete(filePath: string): Promise<void> {
    if (!filePath.startsWith('s3://')) {
      await rm(filePath, { force: true });
      return;
    }
    await this.options.client.send(
      new this.options.sdk.DeleteObjectCommand({
        Bucket: this.options.bucket,
        Key: this.keyOf(filePath),
      }),
    );
  }

  public async stat(filePath: string): Promise<{ size: number }> {
    if (!filePath.startsWith('s3://')) {
      const info = await stat(filePath);
      return { size: info.size };
    }
    const result = await this.options.client.send(
      new this.options.sdk.HeadObjectCommand({
        Bucket: this.options.bucket,
        Key: this.keyOf(filePath),
      }),
    );
    return { size: result.ContentLength ?? 0 };
  }

  public async readStream(
    filePath: string,
    range?: { start: number; end: number },
  ): Promise<Readable> {
    if (!filePath.startsWith('s3://')) {
      return createReadStream(filePath, range);
    }
    return this.openS3Stream(filePath, range);
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await this.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** Async variant of `readStream` for object storage consumers. */
  public async openS3Stream(
    filePath: string,
    range?: { start: number; end: number },
  ): Promise<Readable> {
    const key = this.keyOf(filePath);
    const result = await this.options.client.send(
      new this.options.sdk.GetObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      }),
    );
    const body = result.Body;
    if (!body || typeof (body as Readable).pipe !== 'function') {
      throw new Error('S3 returned an empty or unsupported response body.');
    }
    return body as Readable;
  }

  private async moveLocal(from: string, to: string): Promise<void> {
    await mkdir(path.dirname(to), { recursive: true, mode: 0o700 });
    try {
      await rename(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }
      await copyFile(from, to);
      await rm(from, { force: true });
    }
  }

  private keyOf(filePath: string): string {
    const prefix = `s3://${this.options.bucket}/`;
    if (!filePath.startsWith(prefix)) {
      throw new Error(`Unexpected S3 object URL: ${filePath}`);
    }
    return filePath.slice(prefix.length);
  }
}

/** Load the optional AWS SDK and create an S3 storage adapter. */
export async function createS3UploadStorage(
  options: S3UploadStorageOptions,
): Promise<S3UploadStorage> {
  let sdk: S3Sdk;
  try {
    sdk = await import('@aws-sdk/client-s3');
  } catch {
    throw new Error('S3 storage is not installed. Add the optional @aws-sdk/client-s3 dependency.');
  }
  const client = new sdk.S3Client(options.clientConfig ?? {});
  return new S3UploadStorage({ ...options, client, sdk });
}
