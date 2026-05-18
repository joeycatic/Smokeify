import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SELLER_NAME = "B2B Headshop";
const DEFAULT_SELLER_URL = "https://b2b-headshop.de";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const getValue = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return null;
    return args[index + 1] ?? null;
  };

  return {
    limit: Number(getValue("--limit") ?? 0),
  };
};

const resolveSupplier = async () => {
  const supplierId = process.env.B2B_HEADSHOP_SUPPLIER_ID ?? null;
  const supplierName = process.env.B2B_HEADSHOP_SUPPLIER_NAME ?? null;

  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true, name: true },
    });
    if (!supplier) {
      throw new Error(`Supplier not found for id=${supplierId}`);
    }
    return supplier;
  }

  if (supplierName) {
    const supplier = await prisma.supplier.findUnique({
      where: { name: supplierName },
      select: { id: true, name: true },
    });
    if (supplier) return supplier;
  }

  return null;
};

const buildSupplierFilter = ({ supplierId, sellerName, sellerHost }) => ({
  OR: [
    ...(supplierId ? [{ supplierId }] : []),
    { supplier: { equals: sellerName, mode: "insensitive" } },
    { sellerName: { equals: sellerName, mode: "insensitive" } },
    { sellerUrl: { contains: sellerHost, mode: "insensitive" } },
  ],
});

const run = async () => {
  const { limit } = parseArgs();
  const sellerName =
    process.env.B2B_HEADSHOP_SELLER_NAME ?? DEFAULT_SELLER_NAME;
  const sellerUrl = process.env.B2B_HEADSHOP_SELLER_URL ?? DEFAULT_SELLER_URL;
  const sellerHost = new URL(sellerUrl).hostname.toLowerCase();
  const supplier = await resolveSupplier();

  const where = buildSupplierFilter({
    supplierId: supplier?.id ?? null,
    sellerName,
    sellerHost,
  });

  const supplierProducts = await prisma.product.findMany({
    where,
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      handle: true,
      variants: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          title: true,
          sku: true,
          costCents: true,
        },
      },
    },
  });

  const rows = [];
  for (const product of supplierProducts) {
    for (const variant of product.variants) {
      if (typeof variant.costCents === "number" && variant.costCents > 0) continue;
      rows.push({
        productTitle: product.title,
        handle: product.handle,
        variantTitle: variant.title,
        sku: variant.sku ?? "",
        costCents: variant.costCents,
        variantId: variant.id,
      });
    }
  }

  const limitedRows = limit > 0 ? rows.slice(0, limit) : rows;

  console.log(
    `[report] supplierProducts=${supplierProducts.length} missingCostVariants=${rows.length} shown=${limitedRows.length}`
  );

  if (!limitedRows.length) {
    console.log("[report] No B2B Headshop variants with missing cost.");
    return;
  }

  for (const row of limitedRows) {
    console.log(
      `- product="${row.productTitle}" handle=${row.handle} variant="${row.variantTitle}" sku=${row.sku || "-"} costCents=${row.costCents} variantId=${row.variantId}`
    );
  }
};

run()
  .catch((error) => {
    console.error("[report] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
