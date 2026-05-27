import { randomUUID } from "node:crypto";

import { getDatabasePool, type DatabaseExecutor } from "./db.js";
import type { AppConfig } from "./config.js";

export type AuditAction =
  | "create"
  | "update"
  | "approve"
  | "reject"
  | "delete"
  | "login"
  | "login_failed"
  | "lockout"
  | "logout"
  | "status_change";

export type AuditEntry = {
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorUserId: string;
  actorRole?: string | null;
  actorIpAddress?: string | null;
  actorUserAgent?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  corporateTenantId?: string | null;
};

/**
 * Immutable audit trail service for RBI compliance.
 * Every significant action in the system should be recorded via this service.
 *
 * The audit trail is append-only — no updates or deletes are permitted.
 * For transactional consistency, prefer the `recordInTransaction` method
 * which accepts a database client from an existing transaction.
 */
export class AuditTrailService {
  private readonly db;

  constructor(private readonly config: AppConfig) {
    this.db = getDatabasePool(config);
  }

  /**
   * Records an audit entry using its own database connection.
   * Use this for standalone audit events (e.g., login attempts).
   */
  async record(entry: AuditEntry): Promise<void> {
    await this.insertAuditRow(this.db, entry);
  }

  /**
   * Records an audit entry within an existing database transaction.
   * Use this to ensure the audit record is committed atomically
   * with the business operation it describes.
   */
  async recordInTransaction(executor: DatabaseExecutor, entry: AuditEntry): Promise<void> {
    await this.insertAuditRow(executor, entry);
  }

  /**
   * Lists recent audit entries for a specific entity.
   */
  async listByEntity(entityType: string, entityId: string, limit: number = 50) {
    const result = await this.db.query<AuditTrailRow>(
      `SELECT audit_id, entity_type, entity_id, action, actor_user_id, actor_role,
              actor_ip_address, actor_user_agent, before_state, after_state,
              metadata, corporate_tenant_id, created_at
       FROM audit_trail
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [entityType, entityId, limit]
    );

    return result.rows.map(mapAuditRow);
  }

  /**
   * Lists recent audit entries for a specific actor/user.
   */
  async listByActor(actorUserId: string, limit: number = 50) {
    const result = await this.db.query<AuditTrailRow>(
      `SELECT audit_id, entity_type, entity_id, action, actor_user_id, actor_role,
              actor_ip_address, actor_user_agent, before_state, after_state,
              metadata, corporate_tenant_id, created_at
       FROM audit_trail
       WHERE actor_user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [actorUserId, limit]
    );

    return result.rows.map(mapAuditRow);
  }

  private async insertAuditRow(executor: DatabaseExecutor, entry: AuditEntry): Promise<void> {
    const auditId = `audit-${randomUUID()}`;
    await executor.query(
      `INSERT INTO audit_trail (
         audit_id, entity_type, entity_id, action, actor_user_id, actor_role,
         actor_ip_address, actor_user_agent, before_state, after_state,
         metadata, corporate_tenant_id, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12,
               (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT)`,
      [
        auditId,
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.actorUserId,
        entry.actorRole ?? null,
        entry.actorIpAddress ?? null,
        entry.actorUserAgent ?? null,
        entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        entry.afterState ? JSON.stringify(entry.afterState) : null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.corporateTenantId ?? null
      ]
    );
  }
}

type AuditTrailRow = {
  audit_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string;
  actor_role: string | null;
  actor_ip_address: string | null;
  actor_user_agent: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  corporate_tenant_id: string | null;
  created_at: number | null;
};

function mapAuditRow(row: AuditTrailRow) {
  return {
    auditId: row.audit_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorRole: row.actor_role,
    actorIpAddress: row.actor_ip_address,
    actorUserAgent: row.actor_user_agent,
    beforeState: row.before_state,
    afterState: row.after_state,
    metadata: row.metadata,
    corporateTenantId: row.corporate_tenant_id,
    createdAt: row.created_at
  };
}
