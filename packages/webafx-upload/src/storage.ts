import { createHash } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { UploadStorage } from './types.js';

/** Hash an opaque scope so it cannot become a traversal path segment. */
export function scopeHash(scope: string | undefined): string {
  return createHash('sha256')
    .update(scope ?? 'default')
    .digest('hex')
    .slice(0, 16);
}

/** Keep only characters that are safe in a storage key extension. */
function safeExtension(extension: string): string {
  const value = extension.toLowerCase().replace(/[^.a-z0-9]/g, '');
  return value.startsWith('.') ? value : `.${value}`;
}

/** Keep a role name safe before using it as a file name. */
function safeRole(role: string): string {
  return role.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'original';
}

/**
 * Local filesystem storage.
 *
 * In-progress bytes live under `<root>/tus`; finalized and staged files live
 * under `<root>/scopes/<scope-hash>/…`. The scope hash prevents tenant or
 * workspace names from becoming path components.
 */
export class LocalUploadStorage implements UploadStorage {
  public readonly tusDirectory: string;
  public readonly root: string;

  public constructor(root: string) {
    this.root = path.resolve(root);
    this.tusDirectory = path.join(this.root, 'tus');
  }

  public stagingPath(scope: string | undefined, sessionId: string, extension: string): string {
    return path.join(
      this.root,
      'scopes',
      scopeHash(scope),
      'staging',
      `${sessionId}${safeExtension(extension)}`,
    );
  }

  public finalPath(
    scope: string | undefined,
    fileId: string,
    role: string,
    extension: string,
  ): string {
    return path.join(
      this.root,
      'scopes',
      scopeHash(scope),
      'files',
      fileId,
      `${safeRole(role)}${safeExtension(extension)}`,
    );
  }

  public async ensureParent(filePath: string): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  }

  public async move(from: string, to: string): Promise<void> {
    await this.ensureParent(to);
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

  public async write(filePath: string, data: Uint8Array): Promise<void> {
    await this.ensureParent(filePath);
    await writeFile(filePath, data, { mode: 0o600 });
  }

  public async delete(filePath: string): Promise<void> {
    await rm(filePath, { force: true });
  }

  public async stat(filePath: string): Promise<{ size: number }> {
    const result = await stat(filePath);
    return { size: result.size };
  }

  public async readStream(
    filePath: string,
    range?: { start: number; end: number },
  ): Promise<ReadStream> {
    return createReadStream(filePath, range);
  }

  public async exists(filePath: string): Promise<boolean> {
    try {
      await stat(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
