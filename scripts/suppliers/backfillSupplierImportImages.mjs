import { PrismaClient } from "@prisma/client";
import { extractSupplierImagesFromHtml } from "../../src/lib/bloomtech/scrapeSupplierPreview.mjs";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const CONCURRENCY = 5;

const fetchSupplierImages = async (sourceUrl) => {
  const response = await fetch(sourceUrl, {
    headers: {
      "accept-language": "de-DE,de;q=0.9,en;q=0.8",
      "user-agent": "Mozilla/5.0 (compatible; SmokeifySupplierImageBackfill/1.0)",
    },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return extractSupplierImagesFromHtml(await response.text(), sourceUrl);
};

const mapWithConcurrency = async (items, mapper) => {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index]);
      }
    }),
  );
  return results;
};

const sameUrls = (left, right) =>
  left.length === right.length && left.every((url, index) => url === right[index]);

const main = async () => {
  const items = await prisma.supplierImportItem.findMany({
    where: {
      status: "APPROVED",
      linkedProduct: { status: "DRAFT" },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      sourcePayload: true,
      imageUrls: true,
      linkedProduct: {
        select: {
          id: true,
          images: {
            orderBy: { position: "asc" },
            select: { url: true },
          },
        },
      },
    },
  });

  const inspected = await mapWithConcurrency(items, async (item) => {
    try {
      const imageUrls = await fetchSupplierImages(item.sourceUrl);
      if (imageUrls.length === 0) {
        throw new Error("Supplier gallery returned no product images");
      }
      const catalogUrls = item.linkedProduct?.images.map((image) => image.url) ?? [];
      return {
        item,
        imageUrls,
        changed:
          !sameUrls(item.imageUrls, imageUrls) ||
          !sameUrls(catalogUrls, imageUrls),
      };
    } catch (error) {
      return {
        item,
        error: error instanceof Error ? error.message : "Unknown fetch error",
      };
    }
  });

  const failed = inspected.filter((entry) => entry.error);
  const changed = inspected.filter((entry) => entry.changed);
  console.log(
    `[supplier-image-backfill] mode=${APPLY ? "apply" : "dry-run"} inspected=${items.length} changed=${changed.length} failed=${failed.length}`,
  );
  for (const entry of changed) {
    console.log(
      `[supplier-image-backfill] ${entry.item.title} images=${entry.item.imageUrls.length} -> ${entry.imageUrls.length}`,
    );
  }
  for (const entry of failed) {
    console.warn(
      `[supplier-image-backfill] skipped ${entry.item.title}: ${entry.error}`,
    );
  }

  if (!APPLY || changed.length === 0) return;

  for (const entry of changed) {
    const sourcePayload =
      entry.item.sourcePayload &&
      typeof entry.item.sourcePayload === "object" &&
      !Array.isArray(entry.item.sourcePayload)
        ? {
            ...entry.item.sourcePayload,
            supplierImages: entry.imageUrls,
          }
        : { supplierImages: entry.imageUrls };

    await prisma.$transaction(async (tx) => {
      await tx.supplierImportItem.update({
        where: { id: entry.item.id },
        data: {
          imageUrls: entry.imageUrls,
          sourcePayload,
        },
      });
      if (!entry.item.linkedProduct) return;
      await tx.productImage.deleteMany({
        where: { productId: entry.item.linkedProduct.id },
      });
      await tx.productImage.createMany({
        data: entry.imageUrls.map((url, position) => ({
          productId: entry.item.linkedProduct.id,
          url,
          altText: entry.item.title,
          position,
        })),
      });
    });
  }

  console.log(`[supplier-image-backfill] updated=${changed.length}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
