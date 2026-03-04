import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { Role } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { getAuthTrustHost } from "@/lib/app-config";
import { db } from "@/lib/db";

async function getOrCreateDefaultOrganization() {
  const existingOrg = await db.organization.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existingOrg) {
    return existingOrg;
  }

  return db.organization.create({
    data: {
      name: "Default Organization",
      timezone: "America/New_York",
      weekStartDay: 1
    }
  });
}

async function ensureProvisionedUser(params: {
  email?: string | null;
  name?: string | null;
  image?: string | null;
  providerAccountId?: string | null;
}) {
  const organization = await getOrCreateDefaultOrganization();
  const googleSub = params.providerAccountId?.trim() || `google-fallback:${randomUUID()}`;
  const normalizedEmail =
    params.email?.toLowerCase().trim() ||
    `${googleSub.replace(/[^a-z0-9]/gi, "").slice(0, 40) || "user"}@no-email.local`;

  const existingByEmail = await db.user.findUnique({ where: { email: normalizedEmail } });
  const existingBySub = await db.user.findUnique({ where: { googleSub } });
  const existingUser = existingByEmail ?? existingBySub;

  const user =
    existingUser ??
    (await db.user.create({
      data: {
        email: normalizedEmail,
        googleSub,
        name: params.name,
        avatarUrl: params.image
      }
    }));

  if (!existingUser) {
    await db.organizationUser.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id
        }
      },
      update: {
        active: true
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: Role.employee,
        active: true
      }
    });
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      email: normalizedEmail,
      googleSub,
      name: params.name ?? user.name,
      avatarUrl: params.image ?? user.avatarUrl
    }
  });

  await db.organizationUser.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id
      }
    },
    update: {
      active: true
    },
    create: {
      organizationId: organization.id,
      userId: user.id,
      role: Role.employee,
      active: true
    }
  });
}

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET?.trim() ?? "",
  trustHost: getAuthTrustHost(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ""
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login",
    error: "/auth/error"
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider && account.provider !== "google") {
        return true;
      }
      await ensureProvisionedUser({
        email: user.email,
        name: user.name,
        image: user.image,
        providerAccountId: account?.providerAccountId
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await db.user.findUnique({
          where: { email: user.email },
          include: {
            memberships: {
              where: { active: true },
              take: 1,
              orderBy: { createdAt: "asc" }
            }
          }
        });

        if (dbUser && dbUser.memberships[0]) {
          token.userId = dbUser.id;
          token.role = dbUser.memberships[0].role;
          token.organizationId = dbUser.memberships[0].organizationId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string" && typeof token.organizationId === "string") {
        session.user.id = token.userId;
        session.user.role = (token.role as Role | undefined) ?? Role.employee;
        session.user.organizationId = token.organizationId;
      }
      return session;
    }
  }
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
