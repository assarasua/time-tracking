import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function writeAuditLog(params: {
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson?: Prisma.InputJsonValue | null;
  afterJson?: Prisma.InputJsonValue | null;
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
