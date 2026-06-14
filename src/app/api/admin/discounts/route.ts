import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  createDiscountCode,
  mapDiscountCode,
  normalizeDiscountCode,
  normalizeDiscountCurrency,
} from "@/lib/discountCodes";

export const runtime = "nodejs";

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const discounts = await prisma.discountCode.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({
    discounts: discounts.map(mapDiscountCode),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-discounts:ip:${ip}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    percentOff?: number | string;
    amountOffCents?: number | string;
    currency?: string;
    maxRedemptions?: number | string;
    expiresAt?: number | string;
  };

  const code = normalizeDiscountCode(body.code ?? "");
  if (!code) {
    return NextResponse.json({ error: "Code is required." }, { status: 400 });
  }

  const percentOff = toNumber(body.percentOff);
  const amountOffCents = toNumber(body.amountOffCents);
  if (!percentOff && !amountOffCents) {
    return NextResponse.json(
      { error: "Either percentOff or amountOffCents is required." },
      { status: 400 }
    );
  }
  if (percentOff && (percentOff <= 0 || percentOff > 100)) {
    return NextResponse.json(
      { error: "percentOff must be between 1 and 100." },
      { status: 400 }
    );
  }
  if (amountOffCents && amountOffCents <= 0) {
    return NextResponse.json(
      { error: "amountOffCents must be greater than 0." },
      { status: 400 }
    );
  }

  const currency = normalizeDiscountCurrency(body.currency);
  const maxRedemptions = toNumber(body.maxRedemptions);
  const expiresAt = toNumber(body.expiresAt);

  const existing = await prisma.discountCode.findUnique({ where: { code } });
  if (existing) {
    return NextResponse.json({ error: "Code already exists." }, { status: 409 });
  }

  const discount = await createDiscountCode({
    code,
    percentOff: percentOff ?? undefined,
    amountOffCents: amountOffCents ?? undefined,
    currency,
    maxRedemptions: maxRedemptions ? Math.floor(maxRedemptions) : undefined,
    expiresAt: expiresAt ? new Date(Math.floor(expiresAt) * 1000) : undefined,
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "discount.create",
    targetType: "discount",
    targetId: discount.id,
    summary: `Created discount ${discount.code}`,
  });

  return NextResponse.json({ discount: mapDiscountCode(discount) });
}
