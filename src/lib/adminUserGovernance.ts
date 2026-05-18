import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function verifyAdminPassword(adminUserId: string, adminPassword: string) {
  const normalizedPassword = adminPassword.trim();
  if (!normalizedPassword) {
    return false;
  }

  const admin = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { passwordHash: true },
  });
  if (!admin?.passwordHash) {
    return false;
  }

  return bcrypt.compare(normalizedPassword, admin.passwordHash);
}

export async function countEnabledAdmins(excludedUserId?: string) {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      adminAccessDisabledAt: null,
      ...(excludedUserId ? { id: { not: excludedUserId } } : {}),
    },
  });
}

export async function ensureAnotherEnabledAdminExists(excludedUserId: string) {
  const enabledAdminCount = await countEnabledAdmins(excludedUserId);
  return enabledAdminCount > 0;
}
