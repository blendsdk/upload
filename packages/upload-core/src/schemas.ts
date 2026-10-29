import { z } from 'zod';

/** Zod schema for a browser-declared file descriptor. */
export const uploadFileDescriptorSchema = z.object({
  name: z.string().min(1).max(1024),
  size: z.number().int().nonnegative(),
  type: z.string().max(255).optional(),
  lastModified: z.number().int().nonnegative().optional(),
});

/** Zod schema for server-resolved upload constraints. */
export const uploadConstraintsSchema = z.object({
  accept: z.array(z.string().min(1)).max(100),
  maxSize: z.number().int().nonnegative(),
  maxFiles: z.number().int().positive(),
  minWidth: z.number().int().positive().optional(),
  minHeight: z.number().int().positive().optional(),
  maxWidth: z.number().int().positive().optional(),
  maxHeight: z.number().int().positive().optional(),
  maxPixels: z.number().int().positive().optional(),
});

/** Zod schema for a purpose policy. */
export const uploadPolicySchema = z.object({
  purpose: z.string().min(1).max(128),
  constraints: uploadConstraintsSchema,
  commitMode: z.enum(['immediate', 'deferred']),
  retentionDays: z.number().int().positive().optional(),
  contentDisposition: z.enum(['inline', 'attachment']).optional(),
  description: z.string().optional(),
});

/** Zod schema for one stored file representation. */
export const storedUploadFileSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  name: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  url: z.string().optional(),
});

/** Zod schema for a completed upload result. */
export const uploadResultSchema = z.object({
  files: z.array(storedUploadFileSchema),
  externalId: z.string().optional(),
});

/** Zod schema for creating a session. */
export const createUploadSessionRequestSchema = z.object({
  purpose: z.string().min(1).max(128),
  file: uploadFileDescriptorSchema,
  scope: z.string().max(256).optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  resumeKey: z.string().min(1).max(256).optional(),
  grant: z.string().min(1).max(8192).optional(),
});

/** Zod schema for the create-session response. */
export const createUploadSessionResponseSchema = z.object({
  protocolVersion: z.number().int().positive(),
  id: z.string().uuid(),
  token: z.string().min(1),
  tusEndpoint: z.string().min(1),
  uploadUrl: z.string().min(1).optional(),
  status: z
    .enum([
      'pending',
      'uploading',
      'uploaded',
      'processing',
      'ready',
      'staged',
      'committed',
      'failed',
      'expired',
      'canceled',
    ])
    .optional(),
  result: uploadResultSchema.optional(),
  chunkSize: z.number().int().positive(),
  expiresAt: z.string().min(1),
  constraints: uploadConstraintsSchema,
});

/** Zod schema for a stable error detail. */
export const uploadErrorDetailSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryability: z.enum(['retryable', 'terminal']),
  details: z.record(z.string(), z.unknown()).optional(),
});

/** Zod schema for public session state. */
export const uploadSessionSchema = z.object({
  id: z.string().uuid(),
  scope: z.string().optional(),
  purpose: z.string().min(1),
  status: z.enum([
    'pending',
    'uploading',
    'uploaded',
    'processing',
    'ready',
    'staged',
    'committed',
    'failed',
    'expired',
    'canceled',
  ]),
  file: uploadFileDescriptorSchema,
  bytesUploaded: z.number().int().nonnegative(),
  bytesTotal: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  expiresAt: z.string().min(1),
  completedAt: z.string().optional(),
  error: uploadErrorDetailSchema.optional(),
  result: uploadResultSchema.optional(),
});

/** Zod schema for a policy response. */
export const uploadPolicyResponseSchema = uploadPolicySchema.extend({
  protocolVersion: z.number().int().positive(),
  chunkSize: z.number().int().positive(),
});

/** Zod schema for batch commit. */
export const commitUploadSessionsRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  context: z.record(z.string(), z.unknown()).optional(),
});

/** Zod schema for a batch commit response. */
export const commitUploadSessionsResponseSchema = z.object({
  results: z.array(uploadSessionSchema),
});

/** Zod schema for an empty request. */
export const emptyRequestSchema = z.object({});
