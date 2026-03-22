import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";

const normalizeWebsite = (value?: string | null) => {
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

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: {
      products: {
        select: {
          id: true,
          status: true,
          variants: {
            select: {
              lowStockThreshold: true,
              inventory: {
                select: {
                  quantityOnHand: true,
                  reserved: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return NextResponse.json({
    suppliers: suppliers.map((supplier) => {
      const activeProducts = supplier.products.filter(
        (product) => product.status === "ACTIVE"
      ).length;
      const lowStockProducts = supplier.products.filter((product) =>
        product.variants.some((variant) => {
          const onHand = variant.inventory?.quantityOnHand ?? 0;
          const reserved = variant.inventory?.reserved ?? 0;
          const available = Math.max(0, onHand - reserved);
          return available <= variant.lowStockThreshold;
        })
      ).length;

      return {
        id: supplier.id,
        name: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        website: supplier.website,
        notes: supplier.notes,
        leadTimeDays: supplier.leadTimeDays,
        createdAt: supplier.createdAt,
        updatedAt: supplier.updatedAt,
        productCount: supplier._count.products,
        activeProductCount: activeProducts,
        lowStockProductCount: lowStockProducts,
      };
    }),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-suppliers:ip:${ip}`,
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

  const body = (await request.json()) as {
    name?: string;
    contactName?: string | null;
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    notes?: string | null;
    leadTimeDays?: number | null;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await prisma.supplier.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "Name already exists" }, { status: 409 });
  }

  const websiteResult = normalizeWebsite(body.website);
  if (!websiteResult.ok) {
    return NextResponse.json(
      { error: "Website must be a valid http(s) link" },
      { status: 400 }
    );
  }

  if (
    typeof body.leadTimeDays !== "undefined" &&
    (typeof body.leadTimeDays !== "number" ||
      !Number.isFinite(body.leadTimeDays) ||
      body.leadTimeDays < 0)
  ) {
    return NextResponse.json(
      { error: "Lead time must be a non-negative number" },
      { status: 400 }
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      name,
      contactName: body.contactName?.trim() || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      website: websiteResult.value,
      notes: body.notes?.trim() || null,
      leadTimeDays:
        typeof body.leadTimeDays === "number" ? body.leadTimeDays : null,
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "supplier.create",
    targetType: "supplier",
    targetId: supplier.id,
    summary: `Created supplier ${supplier.name}`,
  });

  return NextResponse.json({ supplier });
}
