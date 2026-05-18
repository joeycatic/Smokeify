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
import { collectMerchantPolicyViolations } from "@/lib/merchantTextPolicy";
import { canAdminPerformAction } from "@/lib/adminPermissions";
import { parseStorefronts, storefrontsToPrisma } from "@/lib/storefronts";
import {
  PRODUCT_COMPLIANCE_STATUSES,
  collectProductComplianceBlockers,
  getProductComplianceEligibility,
  normalizeProductComplianceStatus,
  type ProductComplianceStatus,
} from "@/lib/productCompliance";

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

const normalizeStringList = (value: unknown) =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
            .filter(Boolean),
        ),
      )
    : [];

const normalizeCountryList = (value: unknown) =>
  normalizeStringList(value).map((entry) => entry.toUpperCase());

const GROW_STOREFRONT = "GROW" as const;
const GROW_SETS_SUFFIX = "-sets";

const parseComplianceStatusInput = (value: unknown): ProductComplianceStatus | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return PRODUCT_COMPLIANCE_STATUSES.includes(normalized as ProductComplianceStatus)
    ? (normalized as ProductComplianceStatus)
    : null;
};

const serializeComplianceBlockersForJson = (
  blockers: ReturnType<typeof collectProductComplianceBlockers>,
) =>
  blockers.map((blocker) => ({
    type: blocker.type,
    field: blocker.field,
    reason: blocker.reason,
    ...(blocker.match ? { match: blocker.match } : {}),
  }));

const includesGrowStorefront = (storefronts?: readonly string[] | null) =>
  Array.isArray(storefronts) && storefronts.includes(GROW_STOREFRONT);

const isAssignedGrowCategory = (
  category?:
    | {
        handle?: string | null;
        storefronts?: string[] | null;
        parent?: { storefronts?: string[] | null } | null;
      }
    | null,
) => {
  if (!category) return false;
  if (includesGrowStorefront(category.storefronts)) {
    return true;
  }

  return (
    typeof category.handle === "string" &&
    category.handle.toLowerCase().endsWith(GROW_SETS_SUFFIX) &&
    includesGrowStorefront(category.parent?.storefronts)
  );
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
  if (!canAdminPerformAction(session.user.role, "catalog.product.write")) {
    return NextResponse.json(
      { error: "You do not have permission to edit catalog products." },
      { status: 403 }
    );
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { options: true, inventory: true, pricingProfile: true },
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
  if (!canAdminPerformAction(session.user.role, "catalog.product.write")) {
    return NextResponse.json(
      { error: "You do not have permission to delete catalog products." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    title?: string;
    handle?: string;
    description?: string | null;
    technicalDetails?: string | null;
    shortDescription?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    manufacturer?: string | null;
    productGroup?: string | null;
    supplierId?: string | null;
    sellerName?: string | null;
    sellerUrl?: string | null;
    storefronts?: string[];
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
    merchantUnitPricingMeasure?: string | null;
    merchantUnitPricingBaseMeasure?: string | null;
    merchantCertificationAuthority?: string | null;
    merchantCertificationName?: string | null;
    merchantCertificationCode?: string | null;
    merchantCertificationValue?: string | null;
    complianceStatus?: string | null;
    complianceNotes?: string | null;
    complianceCountryAllowlist?: string[];
    complianceCountryDenylist?: string[];
    complianceAgeGateRequired?: boolean;
    complianceFeedEligible?: boolean;
    complianceAdsEligible?: boolean;
    complianceManualBlockers?: string[];
    tags?: string[];
    status?: string;
    expectedUpdatedAt?: string | null;
  };

  const updates: {
    title?: string;
    handle?: string;
    description?: string | null;
    technicalDetails?: string | null;
    shortDescription?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    manufacturer?: string | null;
    productGroup?: string | null;
    supplier?: string | null;
    supplierId?: string | null;
    sellerName?: string | null;
    sellerUrl?: string | null;
    storefronts?: ("MAIN" | "GROW")[];
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
    merchantUnitPricingMeasure?: string | null;
    merchantUnitPricingBaseMeasure?: string | null;
    merchantCertificationAuthority?: string | null;
    merchantCertificationName?: string | null;
    merchantCertificationCode?: string | null;
    merchantCertificationValue?: string | null;
    complianceStatus?: ProductComplianceStatus;
    complianceReviewedAt?: Date | null;
    complianceReviewedById?: string | null;
    complianceNotes?: string | null;
    complianceCountryAllowlist?: string[];
    complianceCountryDenylist?: string[];
    complianceAgeGateRequired?: boolean;
    complianceFeedEligible?: boolean;
    complianceAdsEligible?: boolean;
    complianceManualBlockers?: string[];
    tags?: string[];
    status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  } = {};

  const existingProduct = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      handle: true,
      description: true,
      technicalDetails: true,
      shortDescription: true,
      manufacturer: true,
      productGroup: true,
      tags: true,
      storefronts: true,
      merchantCertificationAuthority: true,
      merchantCertificationName: true,
      merchantCertificationCode: true,
      merchantCertificationValue: true,
      complianceStatus: true,
      complianceNotes: true,
      complianceCountryAllowlist: true,
      complianceCountryDenylist: true,
      complianceAgeGateRequired: true,
      complianceFeedEligible: true,
      complianceAdsEligible: true,
      complianceManualBlockers: true,
      updatedAt: true,
      mainCategory: {
        select: {
          handle: true,
          storefronts: true,
          parent: { select: { handle: true, storefronts: true } },
        },
      },
      categories: {
        select: {
          category: {
            select: {
              handle: true,
              storefronts: true,
              parent: { select: { handle: true, storefronts: true } },
            },
          },
        },
      },
    },
  });

  if (!existingProduct) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (
    body.expectedUpdatedAt &&
    existingProduct.updatedAt.toISOString() !== body.expectedUpdatedAt
  ) {
    return NextResponse.json(
      {
        error:
          "This product was updated by another admin. Reload the latest version before saving.",
        currentUpdatedAt: existingProduct.updatedAt.toISOString(),
      },
      { status: 409 }
    );
  }

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

  if (typeof body.seoTitle !== "undefined") {
    updates.seoTitle = sanitizePlainText(body.seoTitle);
  }

  if (typeof body.seoDescription !== "undefined") {
    updates.seoDescription = sanitizePlainText(body.seoDescription);
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

  if (typeof body.storefronts !== "undefined") {
    updates.storefronts = storefrontsToPrisma(parseStorefronts(body.storefronts));
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

  if (typeof body.merchantUnitPricingMeasure !== "undefined") {
    updates.merchantUnitPricingMeasure = sanitizePlainText(
      body.merchantUnitPricingMeasure
    );
  }

  if (typeof body.merchantUnitPricingBaseMeasure !== "undefined") {
    updates.merchantUnitPricingBaseMeasure = sanitizePlainText(
      body.merchantUnitPricingBaseMeasure
    );
  }

  if (typeof body.merchantCertificationAuthority !== "undefined") {
    updates.merchantCertificationAuthority = sanitizePlainText(
      body.merchantCertificationAuthority
    );
  }

  if (typeof body.merchantCertificationName !== "undefined") {
    updates.merchantCertificationName = sanitizePlainText(
      body.merchantCertificationName
    );
  }

  if (typeof body.merchantCertificationCode !== "undefined") {
    updates.merchantCertificationCode = sanitizePlainText(
      body.merchantCertificationCode
    );
  }

  if (typeof body.merchantCertificationValue !== "undefined") {
    updates.merchantCertificationValue = sanitizePlainText(
      body.merchantCertificationValue
    );
  }

  if (typeof body.complianceStatus !== "undefined") {
    const nextStatus = parseComplianceStatusInput(body.complianceStatus);
    if (!nextStatus) {
      return NextResponse.json(
        { error: "Invalid compliance status." },
        { status: 400 }
      );
    }
    updates.complianceStatus = nextStatus;
    updates.complianceReviewedAt = new Date();
    updates.complianceReviewedById = session.user.id;
  }

  if (typeof body.complianceNotes !== "undefined") {
    updates.complianceNotes = sanitizePlainText(body.complianceNotes);
  }

  if (typeof body.complianceCountryAllowlist !== "undefined") {
    updates.complianceCountryAllowlist = normalizeCountryList(
      body.complianceCountryAllowlist,
    );
  }

  if (typeof body.complianceCountryDenylist !== "undefined") {
    updates.complianceCountryDenylist = normalizeCountryList(
      body.complianceCountryDenylist,
    );
  }

  if (typeof body.complianceAgeGateRequired === "boolean") {
    updates.complianceAgeGateRequired = body.complianceAgeGateRequired;
  }

  if (typeof body.complianceFeedEligible === "boolean") {
    updates.complianceFeedEligible = body.complianceFeedEligible;
  }

  if (typeof body.complianceAdsEligible === "boolean") {
    updates.complianceAdsEligible = body.complianceAdsEligible;
  }

  if (typeof body.complianceManualBlockers !== "undefined") {
    updates.complianceManualBlockers = normalizeStringList(
      body.complianceManualBlockers,
    );
  }

  if (Array.isArray(body.tags)) {
    updates.tags = body.tags.map((tag) => tag.trim()).filter(Boolean);
  }

  if (body.status) {
    updates.status = parseStatus(body.status);
  }

  const violations = collectMerchantPolicyViolations({
    ...(typeof updates.title === "string" ? { title: updates.title } : {}),
    ...(typeof updates.description !== "undefined"
      ? { description: updates.description }
      : {}),
    ...(typeof updates.technicalDetails !== "undefined"
      ? { technicalDetails: updates.technicalDetails }
      : {}),
    ...(typeof updates.shortDescription !== "undefined"
      ? { shortDescription: updates.shortDescription }
      : {}),
    ...(typeof updates.productGroup !== "undefined"
      ? { productGroup: updates.productGroup }
      : {}),
    ...(Array.isArray(updates.tags) ? { tags: updates.tags.join(" ") } : {}),
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

  const nextComplianceSnapshot = {
    title: updates.title ?? existingProduct.title,
    handle: updates.handle ?? existingProduct.handle,
    description:
      typeof updates.description !== "undefined"
        ? updates.description
        : existingProduct.description,
    shortDescription:
      typeof updates.shortDescription !== "undefined"
        ? updates.shortDescription
        : existingProduct.shortDescription,
    manufacturer:
      typeof updates.manufacturer !== "undefined"
        ? updates.manufacturer
        : existingProduct.manufacturer,
    storefronts: updates.storefronts ?? existingProduct.storefronts,
    merchantCertificationAuthority:
      typeof updates.merchantCertificationAuthority !== "undefined"
        ? updates.merchantCertificationAuthority
        : existingProduct.merchantCertificationAuthority,
    merchantCertificationName:
      typeof updates.merchantCertificationName !== "undefined"
        ? updates.merchantCertificationName
        : existingProduct.merchantCertificationName,
    merchantCertificationCode:
      typeof updates.merchantCertificationCode !== "undefined"
        ? updates.merchantCertificationCode
        : existingProduct.merchantCertificationCode,
    merchantCertificationValue:
      typeof updates.merchantCertificationValue !== "undefined"
        ? updates.merchantCertificationValue
        : existingProduct.merchantCertificationValue,
    complianceStatus: normalizeProductComplianceStatus(
      updates.complianceStatus ?? existingProduct.complianceStatus,
    ),
    complianceCountryAllowlist:
      updates.complianceCountryAllowlist ?? existingProduct.complianceCountryAllowlist,
    complianceCountryDenylist:
      updates.complianceCountryDenylist ?? existingProduct.complianceCountryDenylist,
    complianceAgeGateRequired:
      updates.complianceAgeGateRequired ?? existingProduct.complianceAgeGateRequired,
    complianceFeedEligible:
      updates.complianceFeedEligible ?? existingProduct.complianceFeedEligible,
    complianceAdsEligible:
      updates.complianceAdsEligible ?? existingProduct.complianceAdsEligible,
    complianceManualBlockers:
      updates.complianceManualBlockers ?? existingProduct.complianceManualBlockers,
    mainCategory: existingProduct.mainCategory,
    categories: existingProduct.categories,
  };
  const complianceBlockers = collectProductComplianceBlockers(nextComplianceSnapshot);
  const serializedComplianceBlockers =
    serializeComplianceBlockersForJson(complianceBlockers);
  const assignedToGrow = includesGrowStorefront(nextComplianceSnapshot.storefronts);
  const hasAssignedGrowCategory =
    isAssignedGrowCategory(nextComplianceSnapshot.mainCategory) ||
    nextComplianceSnapshot.categories.some((entry) =>
      isAssignedGrowCategory(entry.category),
    );
  const growStorefrontCompliance = getProductComplianceEligibility(
    nextComplianceSnapshot,
    {
      storefront: "GROW",
      surface: "STOREFRONT",
    },
  );

  if (
    updates.complianceStatus === "APPROVED" &&
    complianceBlockers.length > 0 &&
    !updates.complianceNotes?.trim() &&
    !existingProduct.complianceNotes?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Approval requires a compliance note when automated or manual blockers are present.",
        complianceBlockers,
      },
      { status: 400 },
    );
  }

  if (assignedToGrow && !hasAssignedGrowCategory) {
    return NextResponse.json(
      {
        error:
          "GrowVault assignments require at least one category that is also assigned to the GROW storefront.",
      },
      { status: 400 },
    );
  }

  if (assignedToGrow && !growStorefrontCompliance.allowed) {
    return NextResponse.json(
      {
        error:
          "GrowVault assignments are blocked until the product passes GrowVault compliance checks.",
        complianceBlockers: growStorefrontCompliance.blockers,
      },
      { status: 400 },
    );
  }

  const product = await prisma.product.update({
    where: { id },
    data: updates,
  });

  if (
    updates.complianceStatus &&
    updates.complianceStatus !== existingProduct.complianceStatus
  ) {
    await prisma.productComplianceEvent.create({
      data: {
        productId: id,
        actorId: session.user.id,
        actorEmail: session.user.email ?? null,
        fromStatus: existingProduct.complianceStatus,
        toStatus: updates.complianceStatus,
        blockers: serializedComplianceBlockers,
        notes: updates.complianceNotes ?? existingProduct.complianceNotes,
        metadata: {
          source: "admin.product.patch",
          feedEligible: nextComplianceSnapshot.complianceFeedEligible,
          adsEligible: nextComplianceSnapshot.complianceAdsEligible,
          countryAllowlist: nextComplianceSnapshot.complianceCountryAllowlist,
          countryDenylist: nextComplianceSnapshot.complianceCountryDenylist,
        },
      },
    });
  }

  await logAdminAction({
    actor: { id: session.user.id, email: session.user.email ?? null },
    action: "product.update",
    targetType: "product",
    targetId: id,
    summary: `Updated product fields: ${Object.keys(updates).join(", ")}`,
    metadata: {
      updateKeys: Object.keys(updates),
      complianceBlockers: serializedComplianceBlockers,
    },
  });

  return NextResponse.json({
    product: {
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    },
    complianceBlockers,
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
    reason?: string;
  };
  const adminPassword = body.adminPassword?.trim();
  const reason = body.reason?.trim();
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
  if (!reason) {
    return NextResponse.json(
      { error: "Grund für das Löschen erforderlich." },
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
    summary: `Deleted product (${reason})`,
    metadata: { reason },
  });
  return NextResponse.json({ ok: true });
}
