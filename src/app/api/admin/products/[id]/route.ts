import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStatus, requireAdmin, slugify } from "@/lib/adminCatalog";
import { logAdminAction } from "@/lib/adminAuditLog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import bcrypt from "bcryptjs";
import {
  sanitizePlainText,
  sanitizeProductDescription,
} from "@/lib/sanitizeHtml";

const normalizeSellerUrl = (value?: string | null) => {
  if (typeof value !== "string") return { ok: true, value: null };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { ok: false, value: null };
    }
    return { ok: true, value: url.toString() };
  } catch {
    return { ok: false, value: null };
  }
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { options: true, inventory: true },
      },
      categories: {
        orderBy: { position: "asc" },
        include: { category: true },
      },
      collections: {
        orderBy: { position: "asc" },
        include: { collection: true },
      },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-product-update:ip:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const { id } = await context.params;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    handle?: string;
    description?: string | null;
    technicalDetails?: string | null;
    shortDescription?: string | null;
    manufacturer?: string | null;
    productGroup?: string | null;
    supplierId?: string | null;
    sellerName?: string | null;
    sellerUrl?: string | null;
    leadTimeDays?: number | null;
    weightGrams?: number | null;
    lengthMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    growboxPlantCountMin?: number | null;
    growboxPlantCountMax?: number | null;
    growboxSize?: string | null;
    growboxConnectionDiameterMm?: number[] | null;
    lightSize?: string | null;
    airSystemDiameterMm?: number | null;
    shippingClass?: string | null;
    tags?: string[];
    status?: string;
  };

  const updates: {
    title?: string;
    handle?: string;
    description?: string | null;
    technicalDetails?: string | null;
    shortDescription?: string | null;
    manufacturer?: string | null;
    productGroup?: string | null;
    supplier?: string | null;
    supplierId?: string | null;
    sellerName?: string | null;
    sellerUrl?: string | null;
    leadTimeDays?: number | null;
    weightGrams?: number | null;
    lengthMm?: number | null;
    widthMm?: number | null;
    heightMm?: number | null;
    growboxPlantCountMin?: number | null;
    growboxPlantCountMax?: number | null;
    growboxSize?: string | null;
    growboxConnectionDiameterMm?: number[];
    lightSize?: string | null;
    airSystemDiameterMm?: number | null;
    shippingClass?: string | null;
    tags?: string[];
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    updates.title = title;
  }

  if (typeof body.handle === "string") {
    const handleInput = body.handle.trim();
    if (handleInput) {
      const handle = slugify(handleInput);
      if (handle === "product" && handleInput.toLowerCase() !== "product") {
        return NextResponse.json(
          { error: "Handle must include letters or numbers" },
          { status: 400 }
        );
      }
      const existing = await prisma.product.findUnique({ where: { handle } });
      if (existing && existing.id !== id) {
        return NextResponse.json(
          { error: "Handle already exists" },
          { status: 409 }
        );
      }
      updates.handle = handle;
    }
  }

  if (typeof body.description !== "undefined") {
    updates.description = sanitizeProductDescription(body.description);
  }

  if (typeof body.technicalDetails !== "undefined") {
    updates.technicalDetails = sanitizeProductDescription(
      body.technicalDetails
    );
  }

  if (typeof body.shortDescription !== "undefined") {
    updates.shortDescription = sanitizePlainText(body.shortDescription);
  }

  if (typeof body.manufacturer !== "undefined") {
    updates.manufacturer = body.manufacturer?.trim() || null;
  }

  if (typeof body.productGroup !== "undefined") {
    updates.productGroup = sanitizePlainText(body.productGroup);
  }

  if (typeof body.supplierId !== "undefined") {
    if (!body.supplierId) {
      updates.supplierId = null;
      updates.supplier = null;
    } else {
      const supplier = await prisma.supplier.findUnique({
        where: { id: body.supplierId },
        select: { name: true },
      });
      if (!supplier) {
        return NextResponse.json(
          { error: "Supplier not found" },
          { status: 400 }
        );
      }
      updates.supplierId = body.supplierId;
      updates.supplier = supplier.name;
    }
  }

  if (typeof body.sellerName !== "undefined") {
    updates.sellerName = sanitizePlainText(body.sellerName);
  }

  if (typeof body.sellerUrl !== "undefined") {
    const sellerUrlResult = normalizeSellerUrl(body.sellerUrl);
    if (!sellerUrlResult.ok) {
      return NextResponse.json(
        { error: "Seller URL must be a valid http(s) link" },
        { status: 400 }
      );
    }
    updates.sellerUrl = sellerUrlResult.value;
  }

  if (typeof body.leadTimeDays !== "undefined") {
    updates.leadTimeDays =
      typeof body.leadTimeDays === "number" ? body.leadTimeDays : null;
  }

  if (typeof body.weightGrams !== "undefined") {
    updates.weightGrams =
      typeof body.weightGrams === "number" ? body.weightGrams : null;
  }

  if (typeof body.lengthMm !== "undefined") {
    updates.lengthMm = typeof body.lengthMm === "number" ? body.lengthMm : null;
  }

  if (typeof body.widthMm !== "undefined") {
    updates.widthMm = typeof body.widthMm === "number" ? body.widthMm : null;
  }

  if (typeof body.heightMm !== "undefined") {
    updates.heightMm = typeof body.heightMm === "number" ? body.heightMm : null;
  }

  if (typeof body.growboxPlantCountMin !== "undefined") {
    updates.growboxPlantCountMin =
      typeof body.growboxPlantCountMin === "number"
        ? body.growboxPlantCountMin
        : null;
  }

  if (typeof body.growboxPlantCountMax !== "undefined") {
    updates.growboxPlantCountMax =
      typeof body.growboxPlantCountMax === "number"
        ? body.growboxPlantCountMax
        : null;
  }

  if (typeof body.growboxSize !== "undefined") {
    updates.growboxSize = body.growboxSize?.trim() || null;
  }

  if (typeof body.growboxConnectionDiameterMm !== "undefined") {
    if (Array.isArray(body.growboxConnectionDiameterMm)) {
      updates.growboxConnectionDiameterMm = body.growboxConnectionDiameterMm
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    } else {
      updates.growboxConnectionDiameterMm = [];
    }
  }

  if (typeof body.lightSize !== "undefined") {
    updates.lightSize = body.lightSize?.trim() || null;
  }

  if (typeof body.airSystemDiameterMm !== "undefined") {
    updates.airSystemDiameterMm =
      typeof body.airSystemDiameterMm === "number"
        ? body.airSystemDiameterMm
        : null;
  }

  if (typeof body.shippingClass !== "undefined") {
    updates.shippingClass = body.shippingClass?.trim() || null;
  }

  if (Array.isArray(body.tags)) {
    updates.tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
  }

  if (body.status) {
    updates.status = parseStatus(body.status);
  }

  const product = await prisma.product.update({
    where: { id },
    data: updates,
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "product.update",
    targetType: "product",
    targetId: id,
    summary: `Updated product fields: ${Object.keys(updates).join(", ")}`,
    metadata: { updates },
  });

  return NextResponse.json({
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-product-delete:ip:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte später erneut versuchen." },
      { status: 429 }
    );
  }
  const { id } = await context.params;
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    adminPassword?: string;
  };
  const adminPassword = body.adminPassword?.trim();
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!admin?.passwordHash || !adminPassword) {
    return NextResponse.json(
      { error: "Passwort erforderlich." },
      { status: 400 }
    );
  }
  const validPassword = await bcrypt.compare(adminPassword, admin.passwordHash);
  if (!validPassword) {
    return NextResponse.json({ error: "Passwort ist falsch." }, { status: 401 });
  }

  await prisma.product.delete({ where: { id } });
  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "product.delete",
    targetType: "product",
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
