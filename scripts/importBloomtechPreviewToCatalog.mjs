import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_INPUT = "scripts/bloomtech-supplier-preview.json";
const DEFAULT_SELLER_NAME = "Bloomtech";
const DEFAULT_SELLER_URL = "https://bloomtech.de";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };
  return {
    input: getValue("--input") ?? DEFAULT_INPUT,
    limit: Number(getValue("--limit") ?? 0),
    apply: args.includes("--apply"),
    allowMissingPrice: args.includes("--allow-missing-price"),
    mainCategoryId: getValue("--main-category-id"),
    mainCategoryHandle:
      getValue("--main-category-handle") ?? getValue("--main-category"),
    categoryIds: getValue("--category-ids"),
    categoryHandles: getValue("--category-handles"),
  };
};

const toCents = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
};

const ceilToNext45Or99 = (targetCents) => {
  const normalized = Math.max(0, Math.ceil(targetCents));
  const dollars = Math.floor(normalized / 100);
  const candidates = [
    dollars * 100 + 45,
    dollars * 100 + 99,
    (dollars + 1) * 100 + 45,
  ];
  return candidates.find((candidate) => candidate >= normalized) ?? normalized;
};

const buildSellPriceCents = (costCents) => {
  if (typeof costCents !== "number" || !Number.isFinite(costCents)) return 0;
  const markupTarget = Math.ceil(costCents * 1.15);
  return ceilToNext45Or99(markupTarget);
};

const formatCents = (cents) => (cents / 100).toFixed(2);

const toHttpUrl = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
};

const extractSupplierImageUrls = (item) => {
  const raw = Array.isArray(item?.supplierImages) ? item.supplierImages : [];
  const seen = new Set();
  const urls = [];
  for (const candidate of raw) {
    const normalized = toHttpUrl(candidate);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
};

const parseCsvList = (value) =>
  (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const resolveCategorySelection = async ({
  mainCategoryId,
  mainCategoryHandle,
  categoryIds,
  categoryHandles,
}) => {
  if (mainCategoryId && mainCategoryHandle) {
    throw new Error(
      "Use either --main-category-id or --main-category-handle, not both."
    );
  }
  if (categoryIds && categoryHandles) {
    throw new Error(
      "Use either --category-ids or --category-handles, not both."
    );
  }

  let mainCategory = null;
  if (mainCategoryId) {
    mainCategory = await prisma.category.findUnique({
      where: { id: mainCategoryId },
      select: { id: true, handle: true, name: true },
    });
    if (!mainCategory) {
      throw new Error(`Category not found for --main-category-id=${mainCategoryId}`);
    }
  } else if (mainCategoryHandle) {
    mainCategory = await prisma.category.findUnique({
      where: { handle: mainCategoryHandle },
      select: { id: true, handle: true, name: true },
    });
    if (!mainCategory) {
      throw new Error(
        `Category not found for --main-category-handle=${mainCategoryHandle}`
      );
    }
  }

  let categories = [];
  if (categoryIds) {
    const ids = parseCsvList(categoryIds);
    if (ids.length > 0) {
      categories = await prisma.category.findMany({
        where: { id: { in: ids } },
        select: { id: true, handle: true, name: true },
      });
      const foundIds = new Set(categories.map((entry) => entry.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new Error(
          `Category not found for --category-ids: ${missing.join(", ")}`
        );
      }
    }
  } else if (categoryHandles) {
    const handles = parseCsvList(categoryHandles);
    if (handles.length > 0) {
      categories = await prisma.category.findMany({
        where: { handle: { in: handles } },
        select: { id: true, handle: true, name: true },
      });
      const foundHandles = new Set(categories.map((entry) => entry.handle));
      const missing = handles.filter((handle) => !foundHandles.has(handle));
      if (missing.length > 0) {
        throw new Error(
          `Category not found for --category-handles: ${missing.join(", ")}`
        );
      }
    }
  }

  return {
    mainCategory,
    categories,
  };
};

const slugifyFallback = (value) =>
  (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "") || "item";

const loadPreview = (inputPath) => {
  const absolute = path.isAbsolute(inputPath)
    ? inputPath
    : path.join(process.cwd(), inputPath);
  const raw = fs.readFileSync(absolute, "utf8");
  return JSON.parse(raw);
};

const resolveSupplier = async () => {
  const supplierId = process.env.BLOOMTECH_SUPPLIER_ID ?? null;
  const supplierName = process.env.BLOOMTECH_SUPPLIER_NAME ?? null;
  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true, leadTimeDays: true },
    });
    if (!supplier) {
      throw new Error(`Supplier not found for id=${supplierId}`);
    }
    return supplier;
  }
  if (supplierName) {
    const supplier = await prisma.supplier.findUnique({
      where: { name: supplierName },
      select: { id: true, name: true, leadTimeDays: true },
    });
    if (supplier) return supplier;
  }
  return null;
};

const buildInventoryQuantity = (stock) => {
  if (!stock || typeof stock !== "object") return 0;
  if (typeof stock.quantity === "number" && Number.isFinite(stock.quantity)) {
    return Math.max(0, Math.floor(stock.quantity));
  }
  return 0;
};

const run = async () => {
  const {
    input,
    limit,
    apply,
    allowMissingPrice,
    mainCategoryId,
    mainCategoryHandle,
    categoryIds,
    categoryHandles,
  } = parseArgs();
  const allowWrite = process.env.BLOOMTECH_IMPORT_ALLOW_WRITE === "1";
  const payload = loadPreview(input);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const sellerName = process.env.BLOOMTECH_SELLER_NAME ?? DEFAULT_SELLER_NAME;
  const sellerUrl = process.env.BLOOMTECH_SELLER_URL ?? DEFAULT_SELLER_URL;
  const supplier = await resolveSupplier();
  const categorySelection = await resolveCategorySelection({
    mainCategoryId,
    mainCategoryHandle,
    categoryIds,
    categoryHandles,
  });

  if (!apply || !allowWrite) {
    console.log(
      "[import] Dry run only. Set BLOOMTECH_IMPORT_ALLOW_WRITE=1 and pass --apply to write."
    );
  }

  const results = {
    processed: 0,
    created: 0,
    skipped: 0,
    missingPrice: 0,
  };
  const skippedItems = [];

  for (const item of items) {
    if (limit > 0 && results.processed >= limit) break;
    results.processed += 1;

    const title = typeof item.title === "string" ? item.title.trim() : "";
    if (!title) {
      results.skipped += 1;
      skippedItems.push({ handle: null, title: null, reason: "missing_title" });
      continue;
    }

    const handle =
      typeof item.handle === "string" && item.handle.trim()
        ? item.handle.trim()
        : slugifyFallback(title);

    const sourceUrl =
      typeof item.sourceUrl === "string" ? item.sourceUrl.trim() : "";
    const existingByHandle = await prisma.product.findUnique({
      where: { handle },
      select: { id: true },
    });
    if (existingByHandle) {
      results.skipped += 1;
      skippedItems.push({ handle, title, reason: "duplicate_handle" });
      continue;
    }

    if (sourceUrl) {
      const existingByUrl = await prisma.product.findFirst({
        where: { sellerUrl: sourceUrl },
        select: { id: true },
      });
      if (existingByUrl) {
        results.skipped += 1;
        skippedItems.push({ handle, title, reason: "duplicate_source_url" });
        continue;
      }
    }

    const costCents = toCents(item.price);
    if (costCents === null && !allowMissingPrice) {
      results.missingPrice += 1;
      results.skipped += 1;
      skippedItems.push({ handle, title, reason: "missing_price" });
      continue;
    }
    const sellPriceCents =
      costCents === null ? 0 : buildSellPriceCents(costCents);

    const inventoryQuantity = buildInventoryQuantity(item.stock);
    const supplierImageUrls = extractSupplierImageUrls(item);
    const weightGrams =
      item.supplierWeight && typeof item.supplierWeight.grams === "number"
        ? Math.round(item.supplierWeight.grams)
        : null;

    if (!apply || !allowWrite) {
      const costLabel = costCents === null ? "missing" : formatCents(costCents);
      const priceLabel =
        costCents === null ? "0.00" : formatCents(sellPriceCents);
      console.log(
        `[import] dry-run pricing handle=${handle} cost=${costLabel} price=${priceLabel} images=${supplierImageUrls.length} mainCategory=${categorySelection.mainCategory?.handle ?? "-"} categories=${categorySelection.categories.length}`
      );
      continue;
    }

    await prisma.product.create({
      data: {
        title,
        handle,
        description:
          typeof item.description === "string" ? item.description.trim() : null,
        technicalDetails:
          typeof item.technicalDetails === "string"
            ? item.technicalDetails.trim()
            : null,
        shortDescription:
          typeof item.shortDescription === "string"
            ? item.shortDescription.trim()
            : null,
        manufacturer:
          typeof item.manufacturer === "string"
            ? item.manufacturer.trim()
            : null,
        supplier: supplier?.name ?? null,
        supplierId: supplier?.id ?? null,
        sellerName,
        sellerUrl: sourceUrl || sellerUrl,
        mainCategoryId: categorySelection.mainCategory?.id ?? null,
        leadTimeDays: supplier?.leadTimeDays ?? null,
        weightGrams,
        status: "DRAFT",
        categories:
          categorySelection.categories.length > 0
            ? {
                create: categorySelection.categories.map((category, index) => ({
                  categoryId: category.id,
                  position: index,
                })),
              }
            : undefined,
        images:
          supplierImageUrls.length > 0
            ? {
                create: supplierImageUrls.map((url, index) => ({
                  url,
                  altText: title,
                  position: index,
                })),
              }
            : undefined,
        variants: {
          create: {
            title: "Default",
            sku: handle,
            priceCents: sellPriceCents,
            costCents: costCents ?? 0,
            position: 0,
            inventory: {
              create: {
                quantityOnHand: inventoryQuantity,
                reserved: 0,
              },
            },
          },
        },
      },
    });

    results.created += 1;
  }

  console.log(
    `[import] processed=${results.processed} created=${results.created} skipped=${results.skipped} missingPrice=${results.missingPrice}`
  );
  if (!apply || !allowWrite) {
    if (skippedItems.length > 0) {
      console.log("[import] skipped items:");
      skippedItems.forEach((item) => {
        const handleLabel = item.handle ? `handle=${item.handle}` : "handle=?";
        const titleLabel = item.title ? `title=${item.title}` : "title=?";
        console.log(`- ${handleLabel} ${titleLabel} reason=${item.reason}`);
      });
    } else {
      console.log("[import] no skipped items.");
    }
  }
};

run()
  .catch((error) => {
    console.error("[import] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
