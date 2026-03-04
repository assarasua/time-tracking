import { createHash, randomBytes } from "node:crypto";

import { Role } from "@prisma/client";

import { db } from "@/lib/db";

export const SESSION_COOKIE_NAME = "tt_session";
export const OAUTH_STATE_COOKIE_NAME = "tt_oauth_state";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AppSession = {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    organizationId: string;
  };
  expiresAt: Date;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAppSession(params: { userId: string; organizationId: string }) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.appSession.create({
    data: {
      userId: params.userId,
      organizationId: params.organizationId,
      tokenHash,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export async function revokeAppSessionByToken(token: string | null | undefined) {
  if (!token) return;

  await db.appSession.updateMany({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
}

export async function getAppSessionFromToken(token: string | null | undefined): Promise<AppSession | null> {
  if (!token) {
    return null;
  }

  const record = await db.appSession.findUnique({
    where: {
      tokenHash: hashToken(token)
    },
    include: {
      user: true
    }
  });

  if (!record) {
    return null;
  }

  if (record.revokedAt || record.expiresAt <= new Date()) {
    return null;
  }

  const membership = await db.organizationUser.findFirst({
    where: {
      userId: record.userId,
      organizationId: record.organizationId,
      active: true
    }
  });

  if (!membership) {
    return null;
  }

  return {
    user: {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      role: membership.role,
      organizationId: record.organizationId
    },
    expiresAt: record.expiresAt
  };
}
