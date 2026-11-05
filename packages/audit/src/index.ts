export type AuditActorType = "user" | "service" | "system";
export type AuditOutcome = "succeeded" | "denied" | "failed";

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

export interface AuditSqlExecutor {
  query(statement: string, values?: unknown[]): Promise<unknown>;
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
