import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasAdminAccess } from "@/lib/adminAccess";

export const PRODUCT_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export async function requireFreshAdmin() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user?.id ||
    !hasAdminAccess({
      role: session.user.role,
      adminVerifiedAt: session.user.adminVerifiedAt,
      adminAccessDisabledAt: session.user.adminAccessDisabledAt,
    })
  ) {
    return null;
  }
  return session;
}

export async function assertFreshAdmin() {
  const session = await requireFreshAdmin();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin() {
  return requireFreshAdmin();
}

export async function requireAdminOnly() {
  return requireFreshAdmin();
}

export function slugify(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return normalized || "product";
}

export function parseStatus(value?: string | null): ProductStatus {
  if (!value) return "DRAFT";
  const upper = value.toUpperCase();
  if (PRODUCT_STATUSES.includes(upper as ProductStatus)) {
    return upper as ProductStatus;
  }
  return "DRAFT";
}

export function parseCents(input: unknown) {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input) : null;
  }
  if (typeof input === "string") {
    const normalized = input.replace(",", ".");
    const value = Number(normalized);
    if (!Number.isFinite(value)) return null;
    return Math.round(value);
  }
  return null;
}
