import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseStatus, requireAdmin, slugify } from "@/lib/adminCatalog";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isSameOrigin } from "@/lib/requestSecurity";
import { logAdminAction } from "@/lib/adminAuditLog";
import {
  sanitizePlainText,
  sanitizeProductDescription,
} from "@/lib/sanitizeHtml";
import { collectMerchantPolicyViolations } from "@/lib/merchantTextPolicy";

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

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Select only list-view fields — description/technicalDetails can be
  // several KB of HTML each and are fetched by the individual product editor.
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      handle: true,
      manufacturer: true,
      supplier: true,
      supplierId: true,
      sellerName: true,
      sellerUrl: true,
      productGroup: true,
      shippingClass: true,
      tags: true,
      status: true,
      leadTimeDays: true,
      weightGrams: true,
      lengthMm: true,
      widthMm: true,
      heightMm: true,
      growboxSize: true,
      mainCategoryId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { variants: true, images: true } },
    },
  });

  return NextResponse.json({
    products: products.map((product) => ({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `admin-products:ip:${ip}`,
    limit: 60,
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
    shippingClass?: string | null;
    tags?: string[];
    status?: string;
  };

  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const sellerUrlResult = normalizeSellerUrl(body.sellerUrl);
  if (!sellerUrlResult.ok) {
    return NextResponse.json(
      { error: "Seller URL must be a valid http(s) link" },
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

  const handleInput = body.handle?.trim();
  const handleSource = handleInput || title;
  const baseHandle = slugify(handleSource);
  if (
    handleInput &&
    baseHandle === "product" &&
    handleInput.toLowerCase() !== "product"
  ) {
    return NextResponse.json(
      { error: "Handle must include letters or numbers" },
      { status: 400 }
    );
  }
  let handle = baseHandle;
  let suffix = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { handle } });
    if (!existing) break;
    if (handleInput) {
      return NextResponse.json(
        { error: "Handle already exists" },
        { status: 409 }
      );
    }
    suffix += 1;
    handle = `${baseHandle}-${suffix}`;
  }

  let leadTimeDays =
    typeof body.leadTimeDays === "number" ? body.leadTimeDays : null;
  const supplierId = body.supplierId ?? null;
  let supplierName: string | null = null;
  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { name: true, leadTimeDays: true },
    });
    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier not found" },
        { status: 400 }
      );
    }
    supplierName = supplier.name;
    if (leadTimeDays === null && supplier.leadTimeDays !== null) {
      leadTimeDays = supplier.leadTimeDays;
    }
  }

  const sanitizedDescription = sanitizeProductDescription(body.description);
  const sanitizedTechnicalDetails = sanitizeProductDescription(
    body.technicalDetails
  );
  const sanitizedShortDescription = sanitizePlainText(body.shortDescription);
  const sanitizedProductGroup = sanitizePlainText(body.productGroup);
  const sanitizedSellerName = sanitizePlainText(body.sellerName);
  const sanitizedTags = Array.isArray(body.tags)
    ? body.tags.map((tag) => tag.trim()).filter(Boolean)
    : [];

  const violations = collectMerchantPolicyViolations({
    title,
    description: sanitizedDescription,
    technicalDetails: sanitizedTechnicalDetails,
    shortDescription: sanitizedShortDescription,
    productGroup: sanitizedProductGroup,
    tags: sanitizedTags.join(" "),
  });

  if (violations.length > 0) {
    return NextResponse.json(
      {
        error:
          "Product text includes terms that imply medical claims or illegal use. Please revise wording.",
        violations,
      },
      { status: 400 }
    );
  }

  const product = await prisma.product.create({
    data: {
      title,
      handle,
      description: sanitizedDescription,
      technicalDetails: sanitizedTechnicalDetails,
      shortDescription: sanitizedShortDescription,
      manufacturer: body.manufacturer?.trim() || null,
      productGroup: sanitizedProductGroup,
      supplier: supplierName,
      supplierId,
      sellerName: sanitizedSellerName,
      sellerUrl: sellerUrlResult.value,
      leadTimeDays,
      weightGrams:
        typeof body.weightGrams === "number" ? body.weightGrams : null,
      lengthMm: typeof body.lengthMm === "number" ? body.lengthMm : null,
      widthMm: typeof body.widthMm === "number" ? body.widthMm : null,
      heightMm: typeof body.heightMm === "number" ? body.heightMm : null,
      shippingClass: body.shippingClass?.trim() || null,
      tags: sanitizedTags,
      status: parseStatus(body.status),
      variants: {
        create: {
          title: "Default",
          sku: handle,
          priceCents: 0,
          position: 0,
          inventory: {
            create: {
              quantityOnHand: 0,
              reserved: 0,
            },
          },
        },
      },
    },
    include: {
      _count: { select: { variants: true, images: true } },
    },
  });

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "product.create",
    targetType: "product",
    targetId: product.id,
    summary: `Created product ${product.title}`,
  });

  return NextResponse.json({
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
  });
}
