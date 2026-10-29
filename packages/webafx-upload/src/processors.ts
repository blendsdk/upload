import { randomUUID } from 'node:crypto';
import { UploadError } from '@blendsdk/upload-core';
import sharp, { type Metadata } from 'sharp';
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
 * variants. The original is retained by the finalizer unless a policy chooses
 * otherwise.
 */
export class SharpImageProcessor implements UploadProcessor {
  public async process(context: UploadProcessorContext): Promise<UploadFileRecord[]> {
    if (!context.detectedMime.startsWith('image/')) {
      throw new UploadError('invalid_content', 'The file is not a decodable image.');
    }

    const constraints = context.session.constraints;
    const pipeline = sharp(context.sourcePath, {
      limitInputPixels: constraints.maxPixels ?? 50_000_000,
      sequentialRead: true,
      failOn: 'warning',
    });

    let metadata: Metadata;
    try {
      metadata = await pipeline.metadata();
    } catch {
      throw new UploadError(
        'invalid_content',
        'The image could not be decoded. HEIC files require a server decoder.',
      );
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
      await context.storage.ensureParent(storageKey);
      const info = await sharp(context.sourcePath, {
        limitInputPixels: constraints.maxPixels ?? 50_000_000,
        sequentialRead: true,
      })
        .rotate()
        .resize({ width: variant.width, withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toFile(storageKey);

      files.push({
        id,
        role: variant.role,
        name: context.session.file.name,
        mime: 'image/webp',
        size: info.size,
        width: info.width,
        height: info.height,
        storageKey,
      });
    }

    return files;
  }
}
