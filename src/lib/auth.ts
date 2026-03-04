import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { Role } from "@prisma/client";

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

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET ?? "",
  trustHost: getAuthTrustHost(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email || !account.providerAccountId) {
        return false;
      }

      const existingUser = await db.user.findUnique({ where: { email: user.email } });

      if (existingUser) {
        if (existingUser.googleSub !== account.providerAccountId) {
          await db.user.update({
            where: { id: existingUser.id },
            data: { googleSub: account.providerAccountId }
          });
        }

        const membership = await db.organizationUser.findFirst({
          where: {
            userId: existingUser.id,
            active: true
          }
        });

        if (!membership) {
          const organization = await getOrCreateDefaultOrganization();
          await db.organizationUser.create({
            data: {
              organizationId: organization.id,
              userId: existingUser.id,
              role: Role.employee,
              active: true
            }
          });
        }

        return true;
      }

      const organization = await getOrCreateDefaultOrganization();

      const dbUser = await db.user.create({
        data: {
          email: user.email,
          googleSub: account.providerAccountId,
          name: user.name,
          avatarUrl: user.image
        }
      });

      await db.$transaction([
        db.organizationUser.create({
          data: {
            organizationId: organization.id,
            userId: dbUser.id,
            role: Role.employee,
            active: true
          }
        })
      ]);

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
