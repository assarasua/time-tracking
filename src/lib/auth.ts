import type { NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

async function findMembership(userId: string) {
  const membership = await db.organizationUser.findFirst({
    where: {
      userId,
      active: true,
      organization: {
        id: {
          not: ""
        }
      }
    },
    include: {
      organization: true
    }
  });

  return membership;
}

export const authConfig: NextAuthConfig = {
  secret: env.AUTH_SECRET,
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
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

      const existingUser = await db.user.findUnique({
        where: { email: user.email }
      });

      const dbUser =
        existingUser ??
        (await db.user.create({
          data: {
            email: user.email,
            googleSub: account.providerAccountId,
            name: user.name,
            avatarUrl: user.image
          }
        }));

      if (existingUser && existingUser.googleSub !== account.providerAccountId) {
        return false;
      }

      const membership = await findMembership(dbUser.id);
      if (membership) {
        if (dbUser.googleSub !== account.providerAccountId) {
          await db.user.update({
            where: { id: dbUser.id },
            data: { googleSub: account.providerAccountId }
          });
        }
        return true;
      }

      const invitation = await db.invitation.findFirst({
        where: {
          email: user.email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: new Date()
          }
        },
        include: { organization: true }
      });

      if (!invitation) {
        return false;
      }

      await db.$transaction([
        db.organizationUser.create({
          data: {
            organizationId: invitation.organizationId,
            userId: dbUser.id,
            role: invitation.role,
            active: true
          }
        }),
        db.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() }
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
