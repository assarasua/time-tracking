import { Role } from "@/lib/db/schema";
import { db } from "@/lib/db";
import type { GoogleProfile } from "@/lib/auth/google";

const FORCED_ADMIN_EMAILS = new Set(["h@hutech.ventures"]);

async function getOrCreateDefaultOrganizationTx(tx: typeof db) {
  const existing = await tx.organization.findFirst({
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existing) {
    return existing;
  }

  return tx.organization.create({
    data: {
      name: "Default Organization",
      timezone: "America/New_York",
      weekStartDay: 1
    }
  });
}

export async function provisionUserFromGoogleProfile(profile: GoogleProfile) {
  return db.$transaction(async (tx: typeof db) => {
    const organization = await getOrCreateDefaultOrganizationTx(tx);
    const normalizedEmail = profile.email.toLowerCase().trim();

    const existingBySub = await tx.user.findUnique({ where: { googleSub: profile.sub } });
    const existingByEmail = await tx.user.findUnique({ where: { email: normalizedEmail } });
    const existing = existingBySub ?? existingByEmail;

    const user =
      existing ??
      (await tx.user
        .create({
          data: {
            email: normalizedEmail,
            googleSub: profile.sub,
            name: profile.name,
            avatarUrl: profile.picture
          }
        })
        .catch(async () => {
          const bySub = await tx.user.findUnique({ where: { googleSub: profile.sub } });
          if (bySub) {
            return bySub;
          }
          const byEmail = await tx.user.findUnique({ where: { email: normalizedEmail } });
          if (byEmail) {
            return byEmail;
          }
          throw new Error("Failed to create or load user during provisioning");
        }));

    const updateData: Record<string, unknown> = {
      name: profile.name ?? user.name,
      avatarUrl: profile.picture ?? user.avatarUrl,
      status: "active"
    };

    if (!existingByEmail || existingByEmail.id === user.id) {
      updateData.email = normalizedEmail;
    }
    if (!existingBySub || existingBySub.id === user.id) {
      updateData.googleSub = profile.sub;
    }

    await tx.user.update({
      where: { id: user.id },
      data: updateData
    });

    let membership = await tx.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id
        }
      }
    });

    if (!membership) {
      const memberCount = await tx.organizationUser.count({
        where: {
          organizationId: organization.id,
          active: true
        }
      });

      const role = memberCount === 0 || FORCED_ADMIN_EMAILS.has(normalizedEmail) ? Role.admin : Role.employee;

      try {
        membership = await tx.organizationUser.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            role,
            active: true
          }
        });
      } catch {
        membership = await tx.organizationUser.findUnique({
          where: {
            organizationId_userId: {
              organizationId: organization.id,
              userId: user.id
            }
          }
        });
      }
    }

    if (!membership) {
      throw new Error("Failed to create or fetch organization membership for authenticated user");
    }

    if (!membership.active) {
      membership = await tx.organizationUser.update({
        where: { id: membership.id },
        data: { active: true }
      });
    }

    if (FORCED_ADMIN_EMAILS.has(normalizedEmail) && membership.role !== Role.admin) {
      membership = await tx.organizationUser.update({
        where: { id: membership.id },
        data: { role: Role.admin, active: true }
      });
    }

    return {
      user,
      organization,
      membership
    };
  });
}
