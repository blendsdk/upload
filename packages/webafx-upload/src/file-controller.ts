import type { Request, Response } from 'express';
import { BaseController, type RouteDefinition } from 'blendsdk/webafx';
import { z } from 'zod';
import { UploadApiError, toApiError } from './errors.js';
import { readBearerToken, verifyUploadToken } from './token.js';
import type {
  AuthorizeFileContext,
  UploadFileRecord,
  UploadServerOptions,
  UploadSessionRecord,
  UploadStorage,
  UploadStore,
} from './types.js';

const fileParamsSchema = z.object({ fileId: z.string().min(1).max(256) });

function principalId(principal: unknown): string | undefined {
  if (!principal || typeof principal !== 'object') {
    return undefined;
  }
  const value = principal as Record<string, unknown>;
  const direct = value.id ?? value.user_id ?? value.sub;
  if (typeof direct === 'string' || typeof direct === 'number' || typeof direct === 'bigint') {
    const id = String(direct);
    return id.length > 0 ? id : undefined;
  }
  const user = value.user;
  if (user && typeof user === 'object') {
    const nested = user as Record<string, unknown>;
    const id = nested.id ?? nested.user_id;
    return typeof id === 'string' || typeof id === 'number' || typeof id === 'bigint'
      ? String(id)
      : undefined;
  }
  return undefined;
}

function contentDisposition(session: UploadSessionRecord, file: UploadFileRecord): string {
  const inlineAllowed = file.mime.startsWith('image/') && file.mime !== 'image/svg+xml';
  const mode = inlineAllowed ? (session.contentDisposition ?? 'inline') : 'attachment';
  const encoded = encodeURIComponent(file.name);
  return `${mode}; filename="file"; filename*=UTF-8''${encoded}`;
}

function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | undefined {
  if (!header?.startsWith('bytes=')) {
    return undefined;
  }
  const [rawStart, rawEnd] = header.slice('bytes='.length).split('-', 2);
  const start = Number.parseInt(rawStart ?? '', 10);
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start > end ||
    start >= size
  ) {
    return undefined;
  }
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Authenticated file response controller.
 *
 * The controller is deliberately generic: the host decides who may read a
 * file through `authorizeFile`; the package owns range handling, MIME type,
 * content disposition, caching headers and path safety.
 */
export class UploadFileController extends BaseController {
  public routes(): RouteDefinition[] {
    return [this.route().get('/:fileId').validate(fileParamsSchema).handle(this.serveFile)];
  }

  public async serveFile(req: Request, res: Response): Promise<void> {
    try {
      const options = (await req.services.get<UploadServerOptions>('upload.options'))!;
      const store = (await req.services.get<UploadStore>('upload.store'))!;
      const { fileId } = req.services.getParams<{ fileId: string }>();
      const found = await store.findFile(fileId);
      if (!found) {
        throw new UploadApiError('not_found', 404, 'The file does not exist.');
      }

      const principal = await req.services.get<unknown>('user', undefined);
      const token = readBearerToken(req);
      let authorized = false;
      if (token) {
        const claims = await verifyUploadToken(token, options.tokenSecret);
        authorized = claims.sid === found.session.id;
      }
      const ownerId = principalId(principal);
      if (!authorized && ownerId && found.session.ownerId === ownerId) {
        authorized = true;
      }
      if (!authorized && options.authorizeFile) {
        authorized = await options.authorizeFile({
          principal,
          session: found.session,
          file: found.file,
          request: req,
        } satisfies AuthorizeFileContext);
      }
      if (!authorized) {
        throw new UploadApiError('not_found', 404, 'The file does not exist.');
      }

      const storage = (await req.services.get<UploadStorage>('upload.storage'))!;
      const info = await storage.stat(found.file.storageKey);
      const range = parseRange(req.headers.range, info.size);
      res.setHeader('Content-Type', found.file.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Content-Disposition', contentDisposition(found.session, found.file));
      if (found.file.sha256) {
        res.setHeader('ETag', `"${found.file.sha256}"`);
      }

      const send = async (range?: { start: number; end: number }): Promise<void> => {
        let stream;
        try {
          stream = await storage.readStream(found.file.storageKey, range);
        } catch {
          if (!res.headersSent) {
            res.status(404).end();
          } else {
            res.destroy();
          }
          return;
        }
        stream.on('error', () => {
          if (!res.headersSent) {
            res.status(404).end();
          } else {
            res.destroy();
          }
        });
        stream.pipe(res);
      };

      if (range) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${info.size}`);
        res.setHeader('Content-Length', range.end - range.start + 1);
        await send(range);
      } else {
        res.status(200);
        res.setHeader('Content-Length', info.size);
        await send();
      }
    } catch (error) {
      throw toApiError(error);
    }
  }
}
