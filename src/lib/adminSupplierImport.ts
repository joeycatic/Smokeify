import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/adminCatalog";
import {
  sanitizePlainText,
  sanitizeProductDescription,
} from "@/lib/sanitizeHtml";

const BLOOMTECH_HOSTS = new Set(["bloomtech.de", "www.bloomtech.de"]);
const DEFAULT_MARGIN_PERCENT = 20;

type ImportActor = {
  id?: string | null;
  email?: string | null;
};

type ScrapedBloomtechItem = {
  sourceUrl?: string;
  title?: string;
  manufacturer?: string;
  handle?: string;
  shortDescription?: string;
  description?: string;
  technicalDetails?: string;
  gtin?: string;
  price?: number | null;
  stock?: {
    quantity?: number | null;
  };
  supplierWeight?: {
    grams?: number | null;
  };
  supplierImages?: string[];
};

export type SupplierImportEditableFields = {
  title?: string;
  manufacturer?: string | null;
  handle?: string;
  shortDescription?: string | null;
  description?: string | null;
  technicalDetails?: string | null;
  gtin?: string | null;
  sku?: string | null;
  costCents?: number | null;
  priceCents?: number | null;
  stockQuantity?: number;
  weightGrams?: number | null;
  imageUrls?: string[];
};

export function normalizeBloomtechCategoryUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("A Bloomtech category URL is required.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid Bloomtech category URL.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Bloomtech links must use http or https.");
  }
  if (!BLOOMTECH_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("The category link must point to bloomtech.de.");
  }
  url.hash = "";
  return url.toString();
}

export function normalizeSupplierProductUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  return url.toString();
}

export function calculateSupplierSellPriceCents(
  costCents: number,
  marginPercent = DEFAULT_MARGIN_PERCENT,
) {
  const safeCost = Math.max(0, Math.round(costCents));
  const divisor = 1 - marginPercent / 100;
  if (divisor <= 0) throw new Error("Margin must be below 100%.");
  const target = safeCost / divisor;
  const euros = Math.floor(target / 100);
  const candidates = [euros - 1, euros, euros + 1]
    .filter((entry) => entry >= 0)
    .map((entry) => entry * 100 + 99)
    .filter((entry) => entry > safeCost);
  if (candidates.length === 0) return Math.ceil(target);
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best,
  );
}

function parseSupplierSku(item: ScrapedBloomtechItem) {
  const details = item.technicalDetails ?? "";
  const match = details.match(/(?:^|;\s*)Artikelnummer\s*:\s*([^;]+)/i);
  return match?.[1]?.trim() || null;
}

function normalizeHttpUrls(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.flatMap((entry) => {
        if (typeof entry !== "string") return [];
        try {
          const url = new URL(entry.trim());
          if (url.protocol !== "http:" && url.protocol !== "https:") return [];
          return [url.toString()];
        } catch {
          return [];
        }
      }),
    ),
  );
}

function normalizeNullableInteger(value: unknown) {
  if (value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.round(value));
}

export function normalizeSupplierImportEdits(
  value: SupplierImportEditableFields,
): SupplierImportEditableFields {
  const updates: SupplierImportEditableFields = {};

  if (typeof value.title === "string") updates.title = value.title.trim();
  if (typeof value.handle === "string") updates.handle = slugify(value.handle);
  for (const key of [
    "manufacturer",
    "shortDescription",
    "technicalDetails",
    "gtin",
    "sku",
  ] as const) {
    if (value[key] === null) updates[key] = null;
    else if (typeof value[key] === "string") updates[key] = value[key].trim() || null;
  }
  if (value.description === null) updates.description = null;
  else if (typeof value.description === "string") {
    updates.description = sanitizeProductDescription(value.description);
  }

  for (const key of ["costCents", "priceCents", "weightGrams"] as const) {
    const normalized = normalizeNullableInteger(value[key]);
    if (normalized !== undefined) updates[key] = normalized;
  }
  if (typeof value.stockQuantity === "number" && Number.isFinite(value.stockQuantity)) {
    updates.stockQuantity = Math.max(0, Math.round(value.stockQuantity));
  }
  if (Array.isArray(value.imageUrls)) updates.imageUrls = normalizeHttpUrls(value.imageUrls);

  return updates;
}

function mapScrapedItem(item: ScrapedBloomtechItem) {
  const sourceUrl =
    typeof item.sourceUrl === "string"
      ? normalizeSupplierProductUrl(item.sourceUrl)
      : "";
  const title = item.title?.trim() ?? "";
  if (!sourceUrl || !title) return null;
  const costCents =
    typeof item.price === "number" && Number.isFinite(item.price)
      ? Math.max(0, Math.round(item.price * 100))
      : null;

  return {
    sourceUrl,
    sourcePayload: JSON.parse(JSON.stringify(item)) as Prisma.InputJsonValue,
    title,
    manufacturer: item.manufacturer?.trim() || null,
    handle: slugify(item.handle?.trim() || title),
    shortDescription: sanitizePlainText(item.shortDescription),
    description: sanitizeProductDescription(item.description),
    technicalDetails: sanitizePlainText(item.technicalDetails),
    gtin: item.gtin?.trim() || null,
    sku: parseSupplierSku(item),
    costCents,
    priceCents: costCents === null ? null : calculateSupplierSellPriceCents(costCents),
    stockQuantity:
      typeof item.stock?.quantity === "number" && Number.isFinite(item.stock.quantity)
        ? Math.max(0, Math.floor(item.stock.quantity))
        : 0,
    weightGrams:
      typeof item.supplierWeight?.grams === "number" &&
      Number.isFinite(item.supplierWeight.grams)
        ? Math.max(0, Math.round(item.supplierWeight.grams))
        : null,
    imageUrls: normalizeHttpUrls(item.supplierImages),
  };
}

export const supplierImportItemInclude = {
  batch: true,
  linkedProduct: {
    select: {
      id: true,
      title: true,
      handle: true,
      status: true,
    },
  },
} satisfies Prisma.SupplierImportItemInclude;

type SupplierImportItemWithInclude = Prisma.SupplierImportItemGetPayload<{
  include: typeof supplierImportItemInclude;
}>;

type CatalogChange = {
  label: string;
  currentValue: string;
  incomingValue: string;
};

type CatalogMatchedProduct = {
  id: string;
  title: string;
  handle: string;
  status: string;
};

const formatCatalogText = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized || "—";
};

const formatCatalogCents = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
      }).format(value / 100)
    : "—";

const formatCatalogInteger = (value: number | null | undefined, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value)}${suffix}`
    : "—";

const addCatalogChange = (
  changes: CatalogChange[],
  label: string,
  currentValue: string,
  incomingValue: string,
) => {
  if (currentValue !== incomingValue) {
    changes.push({ label, currentValue, incomingValue });
  }
};

async function addCatalogMatchesToImportItems(
  items: SupplierImportItemWithInclude[],
) {
  if (items.length === 0) return [];

  const sourceUrls = Array.from(new Set(items.map((item) => item.sourceUrl)));
  const handles = Array.from(new Set(items.map((item) => item.handle).filter(Boolean)));
  const skus = Array.from(
    new Set(items.map((item) => item.sku).filter((sku): sku is string => Boolean(sku))),
  );
  const linkedProductIds = Array.from(
    new Set(
      items
        .map((item) => item.linkedProductId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const products = await prisma.product.findMany({
    where: {
      OR: [
        linkedProductIds.length ? { id: { in: linkedProductIds } } : undefined,
        sourceUrls.length ? { sellerUrl: { in: sourceUrls } } : undefined,
        handles.length ? { handle: { in: handles } } : undefined,
        skus.length ? { variants: { some: { sku: { in: skus } } } } : undefined,
      ].filter(Boolean) as Prisma.ProductWhereInput[],
    },
    select: {
      id: true,
      title: true,
      handle: true,
      status: true,
      sellerUrl: true,
      manufacturer: true,
      weightGrams: true,
      images: {
        orderBy: { position: "asc" },
        select: { url: true },
      },
      categories: {
        orderBy: { position: "asc" },
        select: { categoryId: true },
      },
      variants: {
        orderBy: { position: "asc" },
        take: 10,
        select: {
          sku: true,
          costCents: true,
          priceCents: true,
          inventory: {
            select: {
              quantityOnHand: true,
            },
          },
        },
      },
    },
  });

  const productSummary = (product: (typeof products)[number]): CatalogMatchedProduct => ({
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
  });
  const productChanges = (
    item: SupplierImportItemWithInclude,
    product: (typeof products)[number],
  ) => {
    const matchedVariant = item.sku
      ? product.variants.find((entry) => entry.sku === item.sku)
      : null;
    const variant = matchedVariant ?? product.variants[0];
    const categoryIds = Array.from(
      new Set([item.batch.mainCategoryId, ...item.batch.additionalCategoryIds]),
    );
    const currentCategoryIds = product.categories.map((entry) => entry.categoryId);
    const changes: CatalogChange[] = [];

    addCatalogChange(changes, "Title", product.title, item.title);
    addCatalogChange(changes, "Handle", product.handle, item.handle);
    addCatalogChange(
      changes,
      "Manufacturer",
      formatCatalogText(product.manufacturer),
      formatCatalogText(item.manufacturer),
    );
    addCatalogChange(
      changes,
      "SKU",
      formatCatalogText(variant?.sku),
      formatCatalogText(item.sku || item.handle),
    );
    addCatalogChange(
      changes,
      "Supplier cost",
      formatCatalogCents(variant?.costCents),
      formatCatalogCents(item.costCents),
    );
    addCatalogChange(
      changes,
      "Sell price",
      formatCatalogCents(variant?.priceCents),
      formatCatalogCents(item.priceCents),
    );
    addCatalogChange(
      changes,
      "Stock",
      formatCatalogInteger(variant?.inventory?.quantityOnHand),
      formatCatalogInteger(item.stockQuantity),
    );
    addCatalogChange(
      changes,
      "Weight",
      formatCatalogInteger(product.weightGrams, " g"),
      formatCatalogInteger(item.weightGrams, " g"),
    );
    addCatalogChange(
      changes,
      "Images",
      formatCatalogInteger(product.images.length),
      formatCatalogInteger(item.imageUrls.length),
    );
    addCatalogChange(
      changes,
      "Categories",
      `${currentCategoryIds.length} assigned`,
      `${categoryIds.length} assigned`,
    );

    return changes;
  };
  const bySellerUrl = new Map(
    products
      .filter((product) => product.sellerUrl)
      .map((product) => [product.sellerUrl!, product]),
  );
  const byId = new Map(products.map((product) => [product.id, product]));
  const byHandle = new Map(products.map((product) => [product.handle, product]));
  const bySku = new Map(
    products.flatMap((product) =>
      product.variants.flatMap((variant) =>
        variant.sku ? [[variant.sku, product] as const] : [],
      ),
    ),
  );

  return items.map((item) => {
    const matchedProduct =
      (item.linkedProductId ? byId.get(item.linkedProductId) : null) ??
      bySellerUrl.get(item.sourceUrl) ??
      byHandle.get(item.handle) ??
      (item.sku ? bySku.get(item.sku) : null) ??
      null;
    const linkedProduct = item.linkedProduct
      ? {
          id: item.linkedProduct.id,
          title: item.linkedProduct.title,
          handle: item.linkedProduct.handle,
          status: item.linkedProduct.status,
        }
      : null;

    return {
      ...item,
      catalogProduct:
        linkedProduct ?? (matchedProduct ? productSummary(matchedProduct) : null),
      catalogChanges: matchedProduct ? productChanges(item, matchedProduct) : [],
    };
  });
}

export async function getSupplierImportWorkspaceData() {
  const [categories, batches, items] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, handle: true, parentId: true },
    }),
    prisma.supplierImportBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        _count: { select: { items: true } },
      },
    }),
    prisma.supplierImportItem.findMany({
      orderBy: { updatedAt: "desc" },
      take: 250,
      include: supplierImportItemInclude,
    }),
  ]);

  return { categories, batches, items: await addCatalogMatchesToImportItems(items) };
}

export async function createBloomtechImportBatch(input: {
  sourceUrl: string;
  mainCategoryId: string;
  additionalCategoryIds?: string[];
  actor: ImportActor;
}) {
  const sourceUrl = normalizeBloomtechCategoryUrl(input.sourceUrl);
  const categoryIds = Array.from(
    new Set([
      input.mainCategoryId.trim(),
      ...(input.additionalCategoryIds ?? []).map((entry) => entry.trim()),
    ].filter(Boolean)),
  );
  if (!input.mainCategoryId.trim()) throw new Error("Choose a main catalog category.");

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  if (categories.length !== categoryIds.length) {
    throw new Error("One or more selected catalog categories no longer exist.");
  }

  const batch = await prisma.supplierImportBatch.create({
    data: {
      supplierKey: "bloomtech",
      sourceUrl,
      mainCategoryId: input.mainCategoryId.trim(),
      additionalCategoryIds: categoryIds.filter(
        (entry) => entry !== input.mainCategoryId.trim(),
      ),
      createdById: input.actor.id ?? null,
      createdByEmail: input.actor.email ?? null,
    },
  });

  try {
    const bloomtechModule = await import("./bloomtech/scrapeSupplierPreview.mjs");
    const runBloomtechSupplierPreview = bloomtechModule.runBloomtechSupplierPreview as (
      options: Record<string, unknown>,
    ) => Promise<{ items?: ScrapedBloomtechItem[] }>;
    const payload = await runBloomtechSupplierPreview({
      mode: "category",
      url: sourceUrl,
      persistOutput: false,
      logger: console,
    });
    const mapped = (payload.items ?? []).map(mapScrapedItem).filter(Boolean) as Array<
      NonNullable<ReturnType<typeof mapScrapedItem>>
    >;
    const seenUrls = new Set(
      (
        await prisma.supplierImportItem.findMany({
          where: { sourceUrl: { in: mapped.map((item) => item.sourceUrl) } },
          select: { sourceUrl: true },
        })
      ).map((item) => item.sourceUrl),
    );
    const newItems = mapped.filter((item) => !seenUrls.has(item.sourceUrl));

    await prisma.$transaction([
      ...newItems.map((item) =>
        prisma.supplierImportItem.create({
          data: {
            batchId: batch.id,
            ...item,
          },
        }),
      ),
      prisma.supplierImportBatch.update({
        where: { id: batch.id },
        data: {
          fetchedCount: newItems.length,
          skippedCount: mapped.length - newItems.length,
          status: newItems.length === mapped.length ? "READY" : "PARTIAL",
          completedAt: new Date(),
        },
      }),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bloomtech fetch failed.";
    await prisma.supplierImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
      },
    });
    throw error;
  }

  return prisma.supplierImportBatch.findUniqueOrThrow({
    where: { id: batch.id },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: supplierImportItemInclude,
      },
      _count: { select: { items: true } },
    },
  });
}

async function resolveBloomtechSupplier() {
  const configuredId = process.env.BLOOMTECH_SUPPLIER_ID?.trim();
  if (configuredId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: configuredId } });
    if (supplier) return supplier;
  }
  const configuredName = process.env.BLOOMTECH_SUPPLIER_NAME?.trim() || "Bloomtech";
  return prisma.supplier.findUnique({ where: { name: configuredName } });
}

async function syncApprovedItemToCatalog(
  itemId: string,
  options: { forceDraft: boolean },
) {
  const item = await prisma.supplierImportItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { batch: true, linkedProduct: true },
  });
  if (!item.title.trim()) throw new Error("Product title is required before approval.");
  if (item.costCents === null || item.priceCents === null) {
    throw new Error("Cost and selling price are required before approval.");
  }
  const costCents = item.costCents;
  const priceCents = item.priceCents;

  const supplier = await resolveBloomtechSupplier();
  const categoryIds = Array.from(
    new Set([item.batch.mainCategoryId, ...item.batch.additionalCategoryIds]),
  );
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  if (categories.length !== categoryIds.length) {
    throw new Error("The batch contains a catalog category that no longer exists.");
  }

  let product = item.linkedProduct;
  if (!product) {
    product = await prisma.product.findFirst({ where: { sellerUrl: item.sourceUrl } });
  }
  if (!product) {
    const handleMatch = await prisma.product.findUnique({ where: { handle: item.handle } });
    if (handleMatch) product = handleMatch;
  }
  if (!product && item.sku) {
    const skuMatch = await prisma.variant.findUnique({
      where: { sku: item.sku },
      select: { product: true },
    });
    if (skuMatch) product = skuMatch.product;
  }
  if (product) {
    const handleMatch = await prisma.product.findUnique({ where: { handle: item.handle } });
    if (handleMatch && handleMatch.id !== product.id) {
      throw new Error(`The handle "${item.handle}" is already used by another product.`);
    }
  }

  if (item.sku) {
    const skuMatch = await prisma.variant.findUnique({
      where: { sku: item.sku },
      select: { productId: true },
    });
    if (skuMatch && skuMatch.productId !== product?.id) {
      throw new Error(`The SKU "${item.sku}" is already used by another product.`);
    }
  }

  const productData = {
    title: item.title,
    handle: item.handle,
    manufacturer: item.manufacturer,
    shortDescription: item.shortDescription,
    description: item.description,
    technicalDetails: item.technicalDetails,
    supplier: supplier?.name ?? "Bloomtech",
    supplierId: supplier?.id ?? null,
    sellerName: "Bloomtech",
    sellerUrl: item.sourceUrl,
    mainCategoryId: item.batch.mainCategoryId,
    leadTimeDays: supplier?.leadTimeDays ?? null,
    weightGrams: item.weightGrams,
  };

  const linkedProduct = await prisma.$transaction(async (tx) => {
    const savedProduct = product
      ? await tx.product.update({
          where: { id: product.id },
          data: {
            ...productData,
            ...(options.forceDraft ? { status: "DRAFT" as const } : {}),
          },
        })
      : await tx.product.create({
          data: {
            ...productData,
            status: "DRAFT",
          },
        });

    await tx.productCategory.deleteMany({ where: { productId: savedProduct.id } });
    if (categoryIds.length > 0) {
      await tx.productCategory.createMany({
        data: categoryIds.map((categoryId, position) => ({
          productId: savedProduct.id,
          categoryId,
          position,
        })),
      });
    }

    await tx.productImage.deleteMany({ where: { productId: savedProduct.id } });
    if (item.imageUrls.length > 0) {
      await tx.productImage.createMany({
        data: item.imageUrls.map((url, position) => ({
          productId: savedProduct.id,
          url,
          altText: item.title,
          position,
        })),
      });
    }

    const variant =
      item.sku
        ? await tx.variant.findFirst({
            where: { productId: savedProduct.id, sku: item.sku },
            orderBy: { position: "asc" },
          })
        : null;
    const fallbackVariant =
      variant ??
      (await tx.variant.findFirst({
        where: { productId: savedProduct.id },
        orderBy: { position: "asc" },
      }));
    const savedVariant = fallbackVariant
      ? await tx.variant.update({
          where: { id: fallbackVariant.id },
          data: {
            sku: item.sku || item.handle,
            costCents,
            priceCents,
          },
        })
      : await tx.variant.create({
          data: {
            productId: savedProduct.id,
            title: "Default",
            sku: item.sku || item.handle,
            costCents,
            priceCents,
            position: 0,
          },
        });

    await tx.variantInventory.upsert({
      where: { variantId: savedVariant.id },
      update: { quantityOnHand: item.stockQuantity },
      create: {
        variantId: savedVariant.id,
        quantityOnHand: item.stockQuantity,
        reserved: 0,
      },
    });
    return savedProduct;
  });

  return linkedProduct;
}

export async function updateSupplierImportItem(input: {
  itemId: string;
  edits?: SupplierImportEditableFields;
  decision?: "APPROVED" | "DECLINED" | "PENDING";
  actor: ImportActor;
}) {
  const existing = await prisma.supplierImportItem.findUnique({
    where: { id: input.itemId },
    include: supplierImportItemInclude,
  });
  if (!existing) throw new Error("Supplier import item not found.");

  const edits = normalizeSupplierImportEdits(input.edits ?? {});
  if ("title" in edits && !edits.title) throw new Error("Product title cannot be empty.");

  await prisma.supplierImportItem.update({
    where: { id: existing.id },
    data: edits,
  });

  const decision = input.decision;
  if (decision === "APPROVED") {
    try {
      const linkedProduct = await syncApprovedItemToCatalog(existing.id, {
        forceDraft: existing.status !== "APPROVED",
      });
      await prisma.supplierImportItem.update({
        where: { id: existing.id },
        data: {
          status: "APPROVED",
          linkedProductId: linkedProduct.id,
          importError: null,
          decidedAt: new Date(),
          decidedById: input.actor.id ?? null,
          decidedByEmail: input.actor.email ?? null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Catalog import failed.";
      await prisma.supplierImportItem.update({
        where: { id: existing.id },
        data: {
          status: "IMPORT_ERROR",
          importError: message,
          decidedAt: new Date(),
          decidedById: input.actor.id ?? null,
          decidedByEmail: input.actor.email ?? null,
        },
      });
      throw new Error(message);
    }
  } else if (decision === "DECLINED") {
    if (existing.linkedProductId) {
      await prisma.product.update({
        where: { id: existing.linkedProductId },
        data: { status: "DRAFT" },
      });
    }
    await prisma.supplierImportItem.update({
      where: { id: existing.id },
      data: {
        status: "DECLINED",
        importError: null,
        decidedAt: new Date(),
        decidedById: input.actor.id ?? null,
        decidedByEmail: input.actor.email ?? null,
      },
    });
  } else if (decision === "PENDING") {
    await prisma.supplierImportItem.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        importError: null,
        decidedAt: null,
        decidedById: null,
        decidedByEmail: null,
      },
    });
  } else if (existing.status === "APPROVED" && Object.keys(edits).length > 0) {
    try {
      await syncApprovedItemToCatalog(existing.id, { forceDraft: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Catalog synchronization failed.";
      await prisma.supplierImportItem.update({
        where: { id: existing.id },
        data: {
          status: "IMPORT_ERROR",
          importError: message,
        },
      });
      throw new Error(message);
    }
  }

  const item = await prisma.supplierImportItem.findUniqueOrThrow({
    where: { id: existing.id },
    include: supplierImportItemInclude,
  });
  const [itemWithCatalogMatch] = await addCatalogMatchesToImportItems([item]);
  return itemWithCatalogMatch;
}
