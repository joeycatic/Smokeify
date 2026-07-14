import "server-only";

import { Prisma, type DiscountCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DiscountCodeResponse = {
  id: string;
  code: string;
  active: boolean;
  maxRedemptions: number | null;
  timesRedeemed: number;
  expiresAt: number | null;
  createdAt: string | null;
  coupon: {
    id: string | null;
    percentOff: number | null;
    amountOff: number | null;
    currency: string | null;
    duration: string | null;
    durationInMonths: number | null;
    valid: boolean | null;
  };
};

export const normalizeDiscountCode = (value: string) =>
  value.trim().replace(/\s+/g, "").toUpperCase();

export const normalizeDiscountCurrency = (value: unknown) => {
  if (typeof value !== "string") return "EUR";
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(trimmed) ? trimmed : "EUR";
};

export const mapDiscountCode = (discount: DiscountCode): DiscountCodeResponse => {
  const now = Date.now();
  const expiresAt = discount.expiresAt
    ? Math.floor(discount.expiresAt.getTime() / 1000)
    : null;
  const redemptionCapReached =
    typeof discount.maxRedemptions === "number" &&
    discount.timesRedeemed >= discount.maxRedemptions;
  const expired = discount.expiresAt ? discount.expiresAt.getTime() <= now : false;

  return {
    id: discount.id,
    code: discount.code,
    active: discount.active,
    maxRedemptions: discount.maxRedemptions,
    timesRedeemed: discount.timesRedeemed,
    expiresAt,
    createdAt: discount.createdAt?.toISOString() ?? null,
    coupon: {
      id: discount.id,
      percentOff: discount.percentOff,
      amountOff: discount.amountOffCents,
      currency: discount.currency,
      duration: "once",
      durationInMonths: null,
      valid: discount.active && !expired && !redemptionCapReached,
    },
  };
};

const clampDiscount = (value: number, subtotalCents: number) =>
  Math.max(0, Math.min(subtotalCents, Math.round(value)));

export const calculateDiscountCents = (
  discount: Pick<DiscountCode, "amountOffCents" | "currency" | "percentOff">,
  subtotalCents: number,
  currency: string,
) => {
  if (typeof discount.amountOffCents === "number") {
    if (normalizeDiscountCurrency(discount.currency) !== normalizeDiscountCurrency(currency)) {
      return 0;
    }
    return clampDiscount(discount.amountOffCents, subtotalCents);
  }
  if (typeof discount.percentOff === "number") {
    return clampDiscount(subtotalCents * (discount.percentOff / 100), subtotalCents);
  }
  return 0;
};

export const findRedeemableDiscountCode = async ({
  code,
  customerEmail,
  currency,
  subtotalCents,
}: {
  code: string;
  customerEmail?: string | null;
  currency: string;
  subtotalCents: number;
}) => {
  const normalizedCode = normalizeDiscountCode(code);
  if (!normalizedCode) return null;

  const discount = await prisma.discountCode.findFirst({
    where: {
      code: normalizedCode,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (!discount) return null;
  if (
    typeof discount.maxRedemptions === "number" &&
    discount.timesRedeemed >= discount.maxRedemptions
  ) {
    return null;
  }

  const metadata =
    discount.metadata &&
    typeof discount.metadata === "object" &&
    !Array.isArray(discount.metadata)
      ? (discount.metadata as Record<string, unknown>)
      : null;
  const restrictedEmail =
    typeof metadata?.email === "string"
      ? metadata.email.trim().toLowerCase()
      : null;
  if (
    restrictedEmail &&
    customerEmail &&
    restrictedEmail !== customerEmail.trim().toLowerCase()
  ) {
    return null;
  }

  const discountCents = calculateDiscountCents(discount, subtotalCents, currency);
  if (discountCents <= 0) return null;
  return { discount, discountCents };
};

export const createDiscountCode = async ({
  amountOffCents,
  code,
  currency = "EUR",
  expiresAt,
  maxRedemptions,
  metadata,
  percentOff,
  source = "admin",
}: {
  amountOffCents?: number | null;
  code: string;
  currency?: string;
  expiresAt?: Date | null;
  maxRedemptions?: number | null;
  metadata?: Prisma.InputJsonValue;
  percentOff?: number | null;
  source?: string;
}) =>
  prisma.discountCode.create({
    data: {
      amountOffCents: amountOffCents ?? undefined,
      code: normalizeDiscountCode(code),
      currency: normalizeDiscountCurrency(currency),
      expiresAt: expiresAt ?? undefined,
      maxRedemptions: maxRedemptions ?? undefined,
      metadata,
      percentOff: percentOff ?? undefined,
      source,
    },
  });

export const updateDiscountCodeActive = async (id: string, active: boolean) =>
  prisma.discountCode.update({
    where: { id },
    data: { active },
  });

export const recordDiscountRedemption = async (code: string | null | undefined) => {
  const normalizedCode = normalizeDiscountCode(code ?? "");
  if (!normalizedCode) return;
  await prisma.discountCode.updateMany({
    where: {
      code: normalizedCode,
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    data: {
      timesRedeemed: { increment: 1 },
    },
  });
};
