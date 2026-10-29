import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { BaseController, type RouteDefinition } from 'blendsdk/webafx';
import { z } from 'zod';
import {
  UploadError,
  commitUploadSessionsRequestSchema,
  createUploadSessionRequestSchema,
  validateFileDescriptor,
  type CreateUploadSessionRequest,
  type UploadPolicyResponse,
  type UploadSession,
} from '@blendsdk/upload-core';
import { UploadApiError, toApiError } from './errors.js';
import { UploadFinalizer } from './finalizer.js';
import { toPublicSession } from './store.js';
import { createUploadToken, readBearerToken, verifyUploadToken } from './token.js';
import type {
  AuthorizeSessionContext,
  UploadAccess,
  UploadServerOptions,
  UploadSessionRecord,
  UploadStore,
} from './types.js';

const policyParamsSchema = z.object({ purpose: z.string().min(1) });
const sessionParamsSchema = z.object({ id: z.string().uuid() });

function principalId(principal: unknown): string | undefined {
  if (!principal || typeof principal !== 'object') {
    return undefined;
  }
  const value = principal as Record<string, unknown>;
  const direct = value.id ?? value.user_id ?? value.sub;
  if (typeof direct === 'string') {
    return direct;
  }
  const user = value.user;
  if (user && typeof user === 'object') {
    const nested = user as Record<string, unknown>;
    const id = nested.id ?? nested.user_id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

/**
 * JSON API for upload sessions.
 *
 * The controller is intentionally thin: policy, persistence, bytes and
 * finalization live in services so the same pipeline can be mounted in a
 * WebAFX application or tested in isolation.
 */
export class UploadSessionController extends BaseController {
  public routes(): RouteDefinition[] {
    return [
      this.route().get('/policy/:purpose').validate(policyParamsSchema).handle(this.getPolicy),
      this.route()
        .post('/sessions')
        .validate(createUploadSessionRequestSchema)
        .handle(this.createSession),
      this.route().get('/sessions/:id').validate(sessionParamsSchema).handle(this.getSession),
      this.route()
        .post('/sessions/:id/finalize')
        .validate(sessionParamsSchema)
        .handle(this.finalizeSession),
      this.route()
        .post('/sessions/commit')
        .validate(commitUploadSessionsRequestSchema)
        .handle(this.commitSessions),
      this.route()
        .post('/sessions/:id/commit')
        .validate(sessionParamsSchema)
        .handle(this.commitSession),
      this.route().delete('/sessions/:id').validate(sessionParamsSchema).handle(this.cancelSession),
    ];
  }

  private async options(req: Request): Promise<UploadServerOptions> {
    return (await req.services.get<UploadServerOptions>('upload.options'))!;
  }

  private async store(req: Request): Promise<UploadStore> {
    return (await req.services.get<UploadStore>('upload.store'))!;
  }

  private async finalizer(req: Request): Promise<UploadFinalizer> {
    return (await req.services.get<UploadFinalizer>('upload.finalizer'))!;
  }

  private async principal(req: Request): Promise<unknown> {
    return req.services.get<unknown>('user', undefined);
  }

  public async getPolicy(req: Request, res: Response): Promise<void> {
    const options = await this.options(req);
    const { purpose } = req.services.getParams<{ purpose: string }>();
    const policy = options.policies[purpose];
    if (!policy) {
      throw new UploadApiError('not_found', 404, 'No upload policy exists for this purpose.');
    }
    const body: UploadPolicyResponse = {
      ...policy,
      protocolVersion: 1,
      chunkSize: options.chunkSize ?? 8 * 1024 * 1024,
    };
    this.ok(res, body);
  }

  public async createSession(req: Request, res: Response): Promise<void> {
    try {
      const options = await this.options(req);
      const store = await this.store(req);
      const input = req.services.getParams<CreateUploadSessionRequest>();
      const policy = options.policies[input.purpose];
      if (!policy) {
        throw new UploadApiError('not_found', 404, 'No upload policy exists for this purpose.');
      }

      const issues = validateFileDescriptor(input.file, policy.constraints);
      if (issues.length > 0) {
        const issue = issues[0]!;
        throw new UploadApiError(
          issue.code,
          issue.code === 'file_too_large' ? 413 : 400,
          issue.message,
        );
      }

      const principal = await this.principal(req);
      let access: UploadAccess | undefined;
      if (options.authorizeSession) {
        const result = await options.authorizeSession({
          principal,
          input,
          policy,
          request: req,
        } satisfies AuthorizeSessionContext);
        if (result === false) {
          throw new UploadApiError('not_authorized', 403, 'You may not create this upload.');
        }
        access = result ?? undefined;
      }

      const ownerId = access?.ownerId ?? principalId(principal);
      if (!access && !ownerId) {
        throw new UploadApiError('not_authorized', 401, 'Authentication is required.');
      }

      const scope = access?.scope;
      const clientKey = input.resumeKey;
      if (clientKey) {
        const existing = await store.findByClientKey(scope, ownerId, clientKey);
        if (
          existing &&
          existing.status !== 'expired' &&
          existing.status !== 'canceled' &&
          existing.status !== 'committed'
        ) {
          const token = await createUploadToken({
            secret: options.tokenSecret,
            sessionId: existing.id,
            purpose: existing.purpose,
            scope: existing.scope,
            expiresAt: new Date(existing.expiresAt),
          });
          this.ok(res, {
            protocolVersion: 1,
            id: existing.id,
            token,
            tusEndpoint: `${options.basePath ?? '/api/uploads'}/tus`,
            chunkSize: options.chunkSize ?? 8 * 1024 * 1024,
            expiresAt: existing.expiresAt,
            constraints: existing.constraints,
          });
          return;
        }
      }

      const now = new Date();
      const ttl =
        policy.commitMode === 'deferred'
          ? (options.stagedTtlSeconds ?? 7 * 24 * 60 * 60)
          : (options.sessionTtlSeconds ?? 24 * 60 * 60);
      const expiresAt = new Date(now.getTime() + ttl * 1000);
      const id = randomUUID();
      const record: UploadSessionRecord = {
        id,
        scope,
        purpose: policy.purpose,
        status: 'pending',
        file: input.file,
        bytesUploaded: 0,
        bytesTotal: input.file.size,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        updatedAt: now.toISOString(),
        context: input.context ?? {},
        constraints: policy.constraints,
        commitMode: policy.commitMode,
        contentDisposition: policy.contentDisposition,
        retentionDays: policy.retentionDays,
        ...(ownerId ? { ownerId } : {}),
        ...(clientKey ? { clientKey } : {}),
        files: [],
      };
      await store.create(record);
      const token = await createUploadToken({
        secret: options.tokenSecret,
        sessionId: id,
        purpose: policy.purpose,
        scope,
        expiresAt,
      });
      await options.logger?.info('Upload session created', {
        sessionId: id,
        purpose: policy.purpose,
        scope,
      });
      this.created(res, {
        protocolVersion: 1,
        id,
        token,
        tusEndpoint: `${options.basePath ?? '/api/uploads'}/tus`,
        chunkSize: options.chunkSize ?? 8 * 1024 * 1024,
        expiresAt: expiresAt.toISOString(),
        constraints: policy.constraints,
      });
    } catch (error) {
      throw toApiError(error);
    }
  }

  public async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { session } = await this.resolveSession(req);
      this.ok(res, toPublicSession(session));
    } catch (error) {
      throw toApiError(error);
    }
  }

  public async finalizeSession(req: Request, res: Response): Promise<void> {
    try {
      const { session, principal } = await this.resolveSession(req);
      const finalizer = await this.finalizer(req);
      const result = await finalizer.finalize(session.id, principal);
      this.ok(res, toPublicSession(result));
    } catch (error) {
      throw toApiError(error);
    }
  }

  public async commitSessions(req: Request, res: Response): Promise<void> {
    try {
      const { ids, context } = req.services.getParams<{
        ids: string[];
        context?: Record<string, unknown>;
      }>();
      const principal = await this.principal(req);
      if (!principalId(principal)) {
        throw new UploadApiError('not_authorized', 401, 'Authentication is required.');
      }
      const store = await this.store(req);
      const finalizer = await this.finalizer(req);
      const results: UploadSession[] = [];
      for (const id of ids) {
        const session = await store.get(id);
        if (!session) {
          throw new UploadApiError('not_found', 404, `Upload session ${id} does not exist.`);
        }
        if (session.ownerId && session.ownerId !== principalId(principal)) {
          throw new UploadApiError('not_authorized', 403, 'You may not commit this upload.');
        }
        results.push(toPublicSession(await finalizer.commit(id, context, principal)));
      }
      this.ok(res, { results });
    } catch (error) {
      throw toApiError(error);
    }
  }

  public async commitSession(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.services.getParams<{ id: string }>();
      const principal = await this.principal(req);
      if (!principalId(principal)) {
        throw new UploadApiError('not_authorized', 401, 'Authentication is required.');
      }
      const store = await this.store(req);
      const session = await store.get(id);
      if (!session) {
        throw new UploadApiError('not_found', 404, 'The upload session does not exist.');
      }
      if (session.ownerId && session.ownerId !== principalId(principal)) {
        throw new UploadApiError('not_authorized', 403, 'You may not commit this upload.');
      }
      const finalizer = await this.finalizer(req);
      this.ok(res, toPublicSession(await finalizer.commit(id, undefined, principal)));
    } catch (error) {
      throw toApiError(error);
    }
  }

  public async cancelSession(req: Request, res: Response): Promise<void> {
    try {
      const { session, principal } = await this.resolveSession(req);
      const finalizer = await this.finalizer(req);
      await finalizer.delete(session.id, principal);
      this.noContent(res);
    } catch (error) {
      throw toApiError(error);
    }
  }

  private async resolveSession(
    req: Request,
  ): Promise<{ session: UploadSessionRecord; principal: unknown }> {
    const { id } = req.services.getParams<{ id: string }>();
    const token = readBearerToken(req);
    const store = await this.store(req);

    if (token) {
      const claims = await verifyUploadToken(token, (await this.options(req)).tokenSecret);
      if (claims.sid !== id) {
        throw new UploadError('not_authorized', 'The upload token does not match this session.');
      }
      const session = await store.get(id);
      if (!session) {
        throw new UploadError('not_found', 'The upload session does not exist.');
      }
      return { session, principal: undefined };
    }

    const principal = await this.principal(req);
    const ownerId = principalId(principal);
    if (!ownerId) {
      throw new UploadError('not_authorized', 'Authentication is required.');
    }
    const session = await store.get(id);
    if (!session) {
      throw new UploadError('not_found', 'The upload session does not exist.');
    }
    if (session.ownerId && session.ownerId !== ownerId) {
      throw new UploadError('not_authorized', 'You may not access this upload.');
    }
    return { session, principal };
  }
}
