import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { Role } from "@prisma/client";

import { getAuthTrustHost } from "@/lib/app-config";
import { db } from "@/lib/db";
import { cleanEnv } from "@/lib/env-utils";

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
  const normalizedEmail =
    params.email?.toLowerCase().trim() || "unknown-google-user@no-email.local";
  const googleSub = params.providerAccountId?.trim() || `google-email:${normalizedEmail}`;
  const organization = await getOrCreateDefaultOrganization();

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
  secret: cleanEnv(process.env.AUTH_SECRET),
  trustHost: getAuthTrustHost(),
  providers: [
    Google({
      clientId: cleanEnv(process.env.GOOGLE_CLIENT_ID),
      clientSecret: cleanEnv(process.env.GOOGLE_CLIENT_SECRET)
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
    async signIn({ account }) {
      // Never block Google sign-in at callback level; provisioning runs in jwt callback.
      return account?.provider === "google";
    },
    async jwt({ token, user, account }) {
      const email = user?.email ?? (typeof token.email === "string" ? token.email : null);
      if (email) {
        try {
          await ensureProvisionedUser({
            email,
            name: user?.name ?? null,
            image: user?.image ?? null,
            providerAccountId: account?.providerAccountId ?? null
          });
        } catch (error) {
          console.error("Failed to auto-provision user during jwt callback", { email, error });
        }
      }

      if (email) {
        const dbUser =
          (await db.user.findUnique({
            where: { email },
            include: {
              memberships: {
                where: { active: true },
                take: 1,
                orderBy: { createdAt: "asc" }
              }
            }
          })) ??
          null;

        if (dbUser?.memberships[0]) {
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
