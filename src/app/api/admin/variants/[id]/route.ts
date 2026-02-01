import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseCents, requireAdmin } from "@/lib/adminCatalog";
import { sendResendEmail } from "@/lib/resend";
import { logAdminAction } from "@/lib/adminAuditLog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import bcrypt from "bcryptjs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-variant-update:ip:${ip}`,
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
    sku?: string | null;
    priceCents?: number | string;
    costCents?: number | string;
    compareAtCents?: number | string | null;
    position?: number;
    lowStockThreshold?: number;
    options?: { name: string; value: string; imagePosition?: number | null }[];
    inventory?: { quantityOnHand?: number; reserved?: number };
  };

  const updates: {
    title?: string;
    sku?: string | null;
    priceCents?: number;
    costCents?: number;
    compareAtCents?: number | null;
    position?: number;
    lowStockThreshold?: number;
  } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    updates.title = title;
  }

  if (typeof body.sku !== "undefined") {
    updates.sku = body.sku?.trim() || null;
  }

  if (typeof body.priceCents !== "undefined") {
    const priceCents = parseCents(body.priceCents);
    if (priceCents === null) {
      return NextResponse.json({ error: "Price is invalid" }, { status: 400 });
    }
    updates.priceCents = priceCents;
  }

  if (typeof body.costCents !== "undefined") {
    const costCents = parseCents(body.costCents);
    if (costCents === null) {
      return NextResponse.json({ error: "Cost is invalid" }, { status: 400 });
    }
    updates.costCents = costCents;
  }

  if (typeof body.compareAtCents !== "undefined") {
    if (body.compareAtCents === null || body.compareAtCents === "") {
      updates.compareAtCents = null;
    } else {
      const compareAtCents = parseCents(body.compareAtCents);
      if (compareAtCents === null) {
        return NextResponse.json({ error: "Compare-at is invalid" }, { status: 400 });
      }
      updates.compareAtCents = compareAtCents;
    }
  }

  if (typeof body.position === "number") {
    updates.position = body.position;
  }

  if (typeof body.lowStockThreshold === "number") {
    updates.lowStockThreshold = Math.max(0, Math.floor(body.lowStockThreshold));
  }

  const operations: any[] = [
    prisma.variant.update({ where: { id }, data: updates }),
  ];

  if (Array.isArray(body.options)) {
    operations.push(
      prisma.variantOption.deleteMany({ where: { variantId: id } })
    );
    const optionData = body.options
      .map((opt) => ({
        name: opt.name.trim(),
        value: opt.value.trim(),
        imagePosition:
          typeof opt.imagePosition === "number" &&
          Number.isFinite(opt.imagePosition)
            ? Math.max(0, Math.floor(opt.imagePosition))
            : null,
        variantId: id,
      }))
      .filter((opt) => opt.name && opt.value);
    if (optionData.length) {
      operations.push(
        prisma.variantOption.createMany({
          data: optionData,
        })
      );
    }
  }

  if (body.inventory) {
    operations.push(
      prisma.variantInventory.upsert({
        where: { variantId: id },
        update: {
          quantityOnHand: body.inventory.quantityOnHand ?? 0,
          reserved: body.inventory.reserved ?? 0,
        },
        create: {
          variantId: id,
          quantityOnHand: body.inventory.quantityOnHand ?? 0,
          reserved: body.inventory.reserved ?? 0,
        },
      })
    );
  }

  await prisma.$transaction(operations);

  const variant = await prisma.variant.findUnique({
    where: { id },
    include: { options: true, inventory: true, product: true },
  });
  if (variant?.product?.handle) {
    revalidatePath(`/products/${variant.product.handle}`);
  }

  if (variant?.inventory) {
    const available =
      (variant.inventory.quantityOnHand ?? 0) -
      (variant.inventory.reserved ?? 0);
    if (available > 0) {
      const requests = await prisma.backInStockRequest.findMany({
        where: { variantId: id, notifiedAt: null },
      });
      if (requests.length) {
        const productTitle = variant.product?.title ?? "Dein Artikel";
        const variantTitle = variant.title ? ` (${variant.title})` : "";
        await Promise.all(
          requests.map((request) =>
            sendResendEmail({
              to: request.email,
              subject: "Artikel wieder verfugbar",
              html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                  <p><strong>${productTitle}${variantTitle}</strong></p>
                  <p>Der Artikel ist wieder verfugbar.</p>
                </div>
              `,
              text: `${productTitle}${variantTitle}\n\nDer Artikel ist wieder verfugbar.`,
            })
          )
        );
        await prisma.backInStockRequest.updateMany({
          where: { variantId: id, notifiedAt: null },
          data: { notifiedAt: new Date() },
        });
      }
    }
  }

  if (
    Object.keys(updates).length > 0 ||
    Array.isArray(body.options) ||
    body.inventory
  ) {
    await logAdminAction({
      actor: { id: session.user.id, email: session.user.email ?? null },
      action: "variant.update",
      targetType: "variant",
      targetId: id,
      summary: `Updated variant fields: ${Object.keys(updates).join(", ")}`,
      metadata: {
        updatedFields: Object.keys(updates),
        optionsUpdated: Array.isArray(body.options),
        inventoryUpdated: Boolean(body.inventory),
      },
    });
  }

  return NextResponse.json({ variant });
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
    key: `admin-variant-delete:ip:${ip}`,
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

  const variant = await prisma.variant.findUnique({
    where: { id },
    select: { product: { select: { handle: true } } },
  });
  await prisma.variant.delete({ where: { id } });
  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "variant.delete",
    targetType: "variant",
    targetId: id,
  });
  if (variant?.product?.handle) {
    revalidatePath(`/products/${variant.product.handle}`);
  }
  return NextResponse.json({ ok: true });
}
