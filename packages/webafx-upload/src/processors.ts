import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { UploadError } from '@blendsdk/upload-core';
import sharp, { type Metadata } from 'sharp';
import type { HeicDecoder } from './heic.js';
import type { UploadFileRecord, UploadProcessor, UploadProcessorContext } from './types.js';

/** Variant sizes used by the default image processor. */
export const IMAGE_VARIANTS = [
  { role: 'display', width: 2560, quality: 82 },
  { role: 'thumb', width: 320, quality: 78 },
] as const;

/**
 * Default image processor.
 *
 * It verifies the declared image dimensions, auto-rotates from EXIF, strips
 * metadata from the derivatives, and writes WebP display and thumbnail
 * variants. HEIC/HEIF input is converted through an optional decoder first.
 */
export class SharpImageProcessor implements UploadProcessor {
  public constructor(private readonly heicDecoder?: HeicDecoder) {}

  public async process(context: UploadProcessorContext): Promise<UploadFileRecord[]> {
    if (!context.detectedMime.startsWith('image/')) {
      throw new UploadError('invalid_content', 'The file is not a decodable image.');
    }

    const isHeic = context.detectedMime === 'image/heic' || context.detectedMime === 'image/heif';
    if (isHeic && !this.heicDecoder) {
      throw new UploadError('invalid_content', 'HEIC decoding is not configured on this server.');
    }

    let sourcePath = context.sourcePath;
    let temporaryDirectory: string | undefined;
    try {
      if (sourcePath.startsWith('s3://')) {
        temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'blendsdk-image-'));
        const localSource = path.join(
          temporaryDirectory,
          `source${path.extname(sourcePath) || '.bin'}`,
        );
        try {
          const stream = await context.storage.readStream(sourcePath);
          await pipeline(stream, createWriteStream(localSource, { mode: 0o600 }));
        } catch (error) {
          throw new UploadError(
            'processing_failed',
            'The stored image could not be read.',
            'retryable',
            { readError: error instanceof Error ? error.message : String(error) },
          );
        }
        sourcePath = localSource;
      }

      if (isHeic) {
        try {
          const decoded = await this.heicDecoder!.decode(await readFile(sourcePath));
          temporaryDirectory ??= await mkdtemp(path.join(tmpdir(), 'blendsdk-heic-'));
          sourcePath = path.join(temporaryDirectory, 'converted.jpg');
          await writeFile(sourcePath, decoded);
        } catch (error) {
          throw new UploadError(
            'invalid_content',
            error instanceof Error ? error.message : 'The HEIC image could not be decoded.',
          );
        }
      }

      const constraints = context.session.constraints;
      const image = sharp(sourcePath, {
        limitInputPixels: constraints.maxPixels ?? 50_000_000,
        sequentialRead: true,
        failOn: 'warning',
      });

      let metadata: Metadata;
      try {
        metadata = await image.metadata();
      } catch {
        throw new UploadError('invalid_content', 'The image could not be decoded.');
      }

      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (constraints.minWidth && width < constraints.minWidth) {
        throw new UploadError(
          'image_too_small',
          `The image must be at least ${constraints.minWidth}px wide.`,
        );
      }
      if (constraints.minHeight && height < constraints.minHeight) {
        throw new UploadError(
          'image_too_small',
          `The image must be at least ${constraints.minHeight}px high.`,
        );
      }
      if (constraints.maxWidth && width > constraints.maxWidth) {
        throw new UploadError(
          'image_too_large',
          `The image must be at most ${constraints.maxWidth}px wide.`,
        );
      }
      if (constraints.maxHeight && height > constraints.maxHeight) {
        throw new UploadError(
          'image_too_large',
          `The image must be at most ${constraints.maxHeight}px high.`,
        );
      }
      if (constraints.maxPixels && width * height > constraints.maxPixels) {
        throw new UploadError('image_too_large', 'The image has too many pixels.');
      }

      const files: UploadFileRecord[] = [];
      for (const variant of IMAGE_VARIANTS) {
        const id = randomUUID();
        const storageKey = context.storage.finalPath(context.scope, id, variant.role, '.webp');
        const encoded = await sharp(sourcePath, {
          limitInputPixels: constraints.maxPixels ?? 50_000_000,
          sequentialRead: true,
        })
          .rotate()
          .resize({ width: variant.width, withoutEnlargement: true })
          .webp({ quality: variant.quality })
          .toBuffer({ resolveWithObject: true });
        await context.storage.write(storageKey, encoded.data);

        files.push({
          id,
          role: variant.role,
          name: context.session.file.name,
          mime: 'image/webp',
          size: encoded.data.length,
          width: encoded.info.width,
          height: encoded.info.height,
          storageKey,
        });
      }

      return files;
    } finally {
      if (temporaryDirectory) {
        await rm(temporaryDirectory, { recursive: true, force: true });
      }
    }
  }
}
