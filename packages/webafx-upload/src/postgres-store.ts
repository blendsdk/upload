import type { UploadFileRecord, UploadSessionRecord, UploadStore } from './types.js';

/** Minimal SQL executor contract; pass a pg Pool/Client wrapper. */
export interface SqlQuery {
  <T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

/** Migration SQL for the package-owned session table. */
export const UPLOAD_SESSION_SQL = `
CREATE TABLE IF NOT EXISTS upload_session (
  id uuid PRIMARY KEY,
  scope text,
  owner_id text,
  client_key text,
  purpose text NOT NULL,
  status text NOT NULL,
  expires_at timestamptz NOT NULL,
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS upload_session_client_key
  ON upload_session (scope, owner_id, client_key)
  WHERE client_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS upload_session_expiry
  ON upload_session (status, expires_at);
`;

function tableName(value: string | undefined): string {
  const table = value ?? 'upload_session';
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error(`Invalid upload table name: ${table}`);
  }
  return table;
}

/**
 * PostgreSQL session store using a single JSONB record per session.
 *
 * The JSONB shape keeps the adapter independent from application tables and
 * allows future fields to be added without a migration per field. The indexed
 * columns (`scope`, `owner_id`, `client_key`, `status`, `expires_at`) cover the
 * queries that need database-side filtering.
 */
export class PostgresUploadStore implements UploadStore {
  private readonly table: string;

  public constructor(
    private readonly query: SqlQuery,
    table?: string,
  ) {
    this.table = tableName(table);
  }

  public async create(record: UploadSessionRecord): Promise<void> {
    await this.query(
      `INSERT INTO ${this.table} (id, scope, owner_id, client_key, purpose, status, expires_at, record)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        record.id,
        record.scope ?? null,
        record.ownerId ?? null,
        record.clientKey ?? null,
        record.purpose,
        record.status,
        record.expiresAt,
        JSON.stringify(record),
      ],
    );
  }

  public async get(id: string): Promise<UploadSessionRecord | undefined> {
    const result = await this.query<{ record: UploadSessionRecord }>(
      `SELECT record FROM ${this.table} WHERE id = $1`,
      [id],
    );
    return result.rows[0]?.record;
  }

  public async update(
    id: string,
    patch: Partial<UploadSessionRecord>,
  ): Promise<UploadSessionRecord | undefined> {
    const current = await this.get(id);
    if (!current) {
      return undefined;
    }
    const next: UploadSessionRecord = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    const result = await this.query<{ record: UploadSessionRecord }>(
      `UPDATE ${this.table}
       SET scope = $2, owner_id = $3, client_key = $4, purpose = $5, status = $6,
           expires_at = $7, record = $8::jsonb, updated_at = now()
       WHERE id = $1
       RETURNING record`,
      [
        id,
        next.scope ?? null,
        next.ownerId ?? null,
        next.clientKey ?? null,
        next.purpose,
        next.status,
        next.expiresAt,
        JSON.stringify(next),
      ],
    );
    return result.rows[0]?.record;
  }

  public async findByClientKey(
    scope: string | undefined,
    ownerId: string | undefined,
    clientKey: string,
  ): Promise<UploadSessionRecord | undefined> {
    const result = await this.query<{ record: UploadSessionRecord }>(
      `SELECT record FROM ${this.table}
       WHERE scope IS NOT DISTINCT FROM $1
         AND owner_id IS NOT DISTINCT FROM $2
         AND client_key = $3
       LIMIT 1`,
      [scope ?? null, ownerId ?? null, clientKey],
    );
    return result.rows[0]?.record;
  }

  public async findFile(
    fileId: string,
  ): Promise<{ session: UploadSessionRecord; file: UploadFileRecord } | undefined> {
    const result = await this.query<{ record: UploadSessionRecord }>(
      `SELECT record FROM ${this.table}
       WHERE record->'files' @> $1::jsonb
       LIMIT 1`,
      [JSON.stringify([{ id: fileId }])],
    );
    const session = result.rows[0]?.record;
    const file = session?.files.find((candidate) => candidate.id === fileId);
    return session && file ? { session, file } : undefined;
  }

  public async listExpired(now: Date): Promise<UploadSessionRecord[]> {
    const result = await this.query<{ record: UploadSessionRecord }>(
      `SELECT record FROM ${this.table}
       WHERE status NOT IN ('committed', 'canceled', 'expired')
         AND expires_at <= $1`,
      [now.toISOString()],
    );
    return result.rows.map((row) => row.record);
  }

  public async delete(id: string): Promise<void> {
    await this.query(`DELETE FROM ${this.table} WHERE id = $1`, [id]);
  }
}
