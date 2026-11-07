import { many } from '../db.js';

export async function audit(input: {
  workspaceId?: string | null;
  actorId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}): Promise<void> {
  try {
    await many(
      `INSERT INTO audit_logs (workspace_id, actor_id, action, target_type, target_id, meta, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.workspaceId ?? null,
        input.actorId ?? null,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.meta ? JSON.stringify(input.meta) : null,
        input.ip ?? null,
      ],
    );
  } catch (error) {
    // Auditing must never break the main action. Report it for operators.
    console.error('[audit] failed to write entry', error);
  }
}
