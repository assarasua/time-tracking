import { db } from "@/lib/db";
import type { JsonValue } from "@/lib/db/schema";

export async function writeAuditLog(params: {
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson?: JsonValue | null;
  afterJson?: JsonValue | null;
}) {
  await db.auditLog.create({
    data: {
      actorUserId: params.actorUserId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      beforeJson: params.beforeJson ?? undefined,
      afterJson: params.afterJson ?? undefined
    }
  });
}
