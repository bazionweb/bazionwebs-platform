export type AuditActorType = "user" | "service" | "system";
export type AuditOutcome = "succeeded" | "denied" | "failed";

export const DEFAULT_AUDIT_RETENTION_DAYS = 2555; // 7 years operational retention guideline

export interface AuditEvent {
  actorType: AuditActorType;
  actorId: string;
  actorRole?: string | null;
  tenantId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome: AuditOutcome;
  requestId?: string | null;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AuditEventRecord {
  id: string;
  occurredAt: string;
  tenantId: string | null;
  actorType: AuditActorType;
  actorId: string;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: AuditOutcome;
  requestId: string | null;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface AuditQueryFilters {
  tenantId?: string | null;
  actorType?: AuditActorType;
  actorId?: string;
  action?: string;
  resourceType?: string;
  outcome?: AuditOutcome;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSqlQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount?: number | null;
}

export interface AuditSqlExecutor {
  query<Row = Record<string, unknown>>(statement: string, values?: unknown[]): Promise<AuditSqlQueryResult<Row>>;
}

const INSERT_AUDIT_EVENT = `
  INSERT INTO public.platform_audit_events
    (tenant_id, actor_type, actor_id, actor_role, action, resource_type,
     resource_id, outcome, request_id, metadata)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
`;

const sensitiveMetadataKey = /(password|secret|token|cookie|authorization|credential|email|phone|url|payload|body)/i;

function validateEvent(event: AuditEvent): void {
  const required = [
    ["actorId", event.actorId, 128],
    ["action", event.action, 128],
    ["resourceType", event.resourceType, 80],
  ] as const;
  for (const [name, value, max] of required) {
    if (!value.trim() || value.length > max) {
      throw new Error(`Audit event ${name} must be non-empty and at most ${max} characters.`);
    }
  }
  for (const [name, value, max] of [
    ["actorRole", event.actorRole, 64],
    ["resourceId", event.resourceId, 128],
    ["requestId", event.requestId, 128],
  ] as const) {
    if (value != null && value.length > max) {
      throw new Error(`Audit event ${name} exceeds ${max} characters.`);
    }
  }
  for (const [key, value] of Object.entries(event.metadata ?? {})) {
    if (!key.trim() || key.length > 64 || sensitiveMetadataKey.test(key)) {
      throw new Error(`Audit metadata key is not permitted: ${key}`);
    }
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
      throw new Error(`Audit metadata value for ${key} must be scalar.`);
    }
    if (typeof value === "string" && value.length > 256) {
      throw new Error(`Audit metadata value for ${key} is too long.`);
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`Audit metadata value for ${key} must be finite.`);
    }
  }
}

/**
 * Append-only writer. Use safe, operational metadata only: never put secrets,
 * tokens, credentials or personal contact details into audit metadata.
 */
export class PostgresAuditEventWriter {
  constructor(private readonly executor: AuditSqlExecutor) {}

  async append(event: AuditEvent): Promise<void> {
    validateEvent(event);
    await this.executor.query(INSERT_AUDIT_EVENT, [
      event.tenantId ?? null,
      event.actorType,
      event.actorId,
      event.actorRole ?? null,
      event.action,
      event.resourceType,
      event.resourceId ?? null,
      event.outcome,
      event.requestId ?? null,
      JSON.stringify(event.metadata ?? {}),
    ]);
  }
}

interface AuditDbRow {
  id: string;
  occurred_at: string | Date;
  tenant_id: string | null;
  actor_type: AuditActorType;
  actor_id: string;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  outcome: AuditOutcome;
  request_id: string | null;
  metadata: Readonly<Record<string, string | number | boolean | null>> | null;
}

function buildWhereClause(filters: AuditQueryFilters): { whereSql: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.tenantId) {
    values.push(filters.tenantId);
    clauses.push(`tenant_id = $${values.length}`);
  }
  if (filters.actorType) {
    values.push(filters.actorType);
    clauses.push(`actor_type = $${values.length}`);
  }
  if (filters.actorId) {
    values.push(filters.actorId);
    clauses.push(`actor_id = $${values.length}`);
  }
  if (filters.action) {
    values.push(`${filters.action}%`);
    clauses.push(`action ILIKE $${values.length}`);
  }
  if (filters.resourceType) {
    values.push(filters.resourceType);
    clauses.push(`resource_type = $${values.length}`);
  }
  if (filters.outcome) {
    values.push(filters.outcome);
    clauses.push(`outcome = $${values.length}`);
  }
  if (filters.from) {
    values.push(filters.from);
    clauses.push(`occurred_at >= $${values.length}::timestamptz`);
  }
  if (filters.to) {
    values.push(filters.to);
    clauses.push(`occurred_at <= $${values.length}::timestamptz`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    const param = `$${values.length}`;
    clauses.push(`(action ILIKE ${param} OR resource_type ILIKE ${param} OR COALESCE(resource_id, '') ILIKE ${param} OR actor_id ILIKE ${param})`);
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
  };
}

function mapAuditRow(row: AuditDbRow): AuditEventRecord {
  return {
    id: row.id,
    occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
    tenantId: row.tenant_id ?? null,
    actorType: row.actor_type,
    actorId: row.actor_id,
    actorRole: row.actor_role ?? null,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id ?? null,
    outcome: row.outcome,
    requestId: row.request_id ?? null,
    metadata: row.metadata ?? {},
  };
}

/**
 * Permissioned audit reader supporting structured filters and bounded exports.
 */
export class PostgresAuditEventReader {
  constructor(private readonly executor: AuditSqlExecutor) {}

  async list(filters: AuditQueryFilters = {}): Promise<{ items: AuditEventRecord[]; total: number; limit: number; offset: number }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);
    const { whereSql, values } = buildWhereClause(filters);

    const countResult = await this.executor.query<{ total: string | number }>(
      `SELECT count(*)::text AS total FROM public.platform_audit_events ${whereSql}`,
      values,
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    const pageValues = [...values, limit, offset];
    const rowsResult = await this.executor.query<AuditDbRow>(
      `SELECT id, occurred_at, tenant_id, actor_type, actor_id, actor_role, action,
              resource_type, resource_id, outcome, request_id, metadata
         FROM public.platform_audit_events
         ${whereSql}
        ORDER BY occurred_at DESC, id DESC
        LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
      pageValues,
    );

    return {
      items: rowsResult.rows.map(mapAuditRow),
      total,
      limit,
      offset,
    };
  }
}

function escapeCsvCell(value: string | null | undefined): string {
  const str = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function serializeAuditEventsCsv(events: readonly AuditEventRecord[]): string {
  const header = "id,occurredAt,tenantId,actorType,actorId,actorRole,action,resourceType,resourceId,outcome,requestId,metadata";
  const lines = events.map((event) =>
    [
      escapeCsvCell(event.id),
      escapeCsvCell(event.occurredAt),
      escapeCsvCell(event.tenantId),
      escapeCsvCell(event.actorType),
      escapeCsvCell(event.actorId),
      escapeCsvCell(event.actorRole),
      escapeCsvCell(event.action),
      escapeCsvCell(event.resourceType),
      escapeCsvCell(event.resourceId),
      escapeCsvCell(event.outcome),
      escapeCsvCell(event.requestId),
      escapeCsvCell(JSON.stringify(event.metadata)),
    ].join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}

export function serializeAuditEventsJson(events: readonly AuditEventRecord[]): string {
  return `${JSON.stringify({ exportedAt: new Date().toISOString(), count: events.length, items: events }, null, 2)}\n`;
}
