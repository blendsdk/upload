import { SignJWT, jwtVerify } from 'jose';
import { UploadError } from '@blendsdk/upload-core';

const ISSUER = 'blendsdk-upload';
const AUDIENCE = 'blendsdk-upload';

/** Claims carried by a short-lived upload token. */
export interface UploadTokenClaims {
  /** Session id. */
  sid: string;
  /** Opaque application scope. */
  scope?: string;
  /** Policy purpose. */
  purpose: string;
  /** Expiry, seconds since epoch. */
  exp: number;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Issue a token bound to one session. */
export async function createUploadToken(input: {
  secret: string;
  sessionId: string;
  purpose: string;
  scope?: string;
  expiresAt: Date;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    sid: input.sessionId,
    purpose: input.purpose,
  };
  if (input.scope) {
    payload.scope = input.scope;
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(input.expiresAt.getTime() / 1000))
    .sign(key(input.secret));
}

/** Verify a token and return its claims. */
export async function verifyUploadToken(token: string, secret: string): Promise<UploadTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (
      typeof payload.sid !== 'string' ||
      typeof payload.purpose !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new Error('Missing upload token claims.');
    }
    return {
      sid: payload.sid,
      purpose: payload.purpose,
      exp: payload.exp,
      ...(typeof payload.scope === 'string' ? { scope: payload.scope } : {}),
    };
  } catch {
    throw new UploadError('not_authorized', 'The upload token is invalid or expired.', 'terminal');
  }
}

/** Extract a bearer token from a Web Request or an Express request. */
export function readBearerToken(request: {
  headers?: { get?(name: string): string | null } | Record<string, string | string[] | undefined>;
}): string | undefined {
  const headers = request.headers;
  if (!headers) {
    return undefined;
  }
  const match = (value: string | undefined): string | undefined => {
    const result = value ? /^Bearer\s+(.+)$/i.exec(value) : null;
    return result?.[1];
  };
  const candidate = headers as { get?: (name: string) => string | null };
  if (typeof candidate.get === 'function') {
    return match(candidate.get('authorization') ?? undefined);
  }
  const values = headers as Record<string, string | string[] | undefined>;
  const raw = values.authorization;
  return match(Array.isArray(raw) ? raw[0] : raw);
}
