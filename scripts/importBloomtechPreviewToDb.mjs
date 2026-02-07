import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_INPUT = "scripts/bloomtech-preview.json";
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
  };
};

const toCents = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 100);
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
  const { input, limit, apply, allowMissingPrice } = parseArgs();
  const allowWrite = process.env.BLOOMTECH_IMPORT_ALLOW_WRITE === "1";
  const payload = loadPreview(input);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const sellerName = process.env.BLOOMTECH_SELLER_NAME ?? DEFAULT_SELLER_NAME;
  const sellerUrl = process.env.BLOOMTECH_SELLER_URL ?? DEFAULT_SELLER_URL;
  const supplier = await resolveSupplier();

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

    const priceCents = toCents(item.price);
    if (priceCents === null && !allowMissingPrice) {
      results.missingPrice += 1;
      results.skipped += 1;
      skippedItems.push({ handle, title, reason: "missing_price" });
      continue;
    }

    const inventoryQuantity = buildInventoryQuantity(item.stock);
    const weightGrams =
      item.supplierWeight && typeof item.supplierWeight.grams === "number"
        ? Math.round(item.supplierWeight.grams)
        : null;

    if (!apply || !allowWrite) continue;

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
        leadTimeDays: supplier?.leadTimeDays ?? null,
        weightGrams,
        status: "DRAFT",
        variants: {
          create: {
            title: "Default",
            sku: handle,
            priceCents: 0,
            costCents: priceCents ?? 0,
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
