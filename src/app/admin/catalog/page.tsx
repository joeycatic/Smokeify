import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireAdminScope } from "@/lib/adminCatalog";
import { getProductPerformance, getStockCoverageMap } from "@/lib/adminInsights";
import { prisma } from "@/lib/prisma";
import { parseStorefront } from "@/lib/storefronts";
import AdminCatalogClient from "./AdminCatalogClient";

const PAGE_SIZE = 25;
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string | string[];
    q?: string | string[];
    sort?: string | string[];
    dir?: string | string[];
    storefront?: string | string[];
    supplier?: string | string[];
    category?: string | string[];
    collection?: string | string[];
  }>;
}) {
  if (!(await requireAdminScope("catalog.read"))) notFound();

  const resolvedSearchParams = await searchParams;
  const rawQuery = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0] ?? ""
    : resolvedSearchParams?.q ?? "";
  const rawSort = Array.isArray(resolvedSearchParams?.sort)
    ? resolvedSearchParams?.sort[0] ?? ""
    : resolvedSearchParams?.sort ?? "";
  const rawDir = Array.isArray(resolvedSearchParams?.dir)
    ? resolvedSearchParams?.dir[0] ?? ""
    : resolvedSearchParams?.dir ?? "";
  const rawStorefront = Array.isArray(resolvedSearchParams?.storefront)
    ? resolvedSearchParams?.storefront[0] ?? ""
    : resolvedSearchParams?.storefront ?? "";
  const rawSupplier = Array.isArray(resolvedSearchParams?.supplier)
    ? resolvedSearchParams?.supplier[0] ?? ""
    : resolvedSearchParams?.supplier ?? "";
  const rawCategory = Array.isArray(resolvedSearchParams?.category)
    ? resolvedSearchParams?.category[0] ?? ""
    : resolvedSearchParams?.category ?? "";
  const rawCollection = Array.isArray(resolvedSearchParams?.collection)
    ? resolvedSearchParams?.collection[0] ?? ""
    : resolvedSearchParams?.collection ?? "";
  const pageParamValue = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams?.page[0] ?? "1"
    : resolvedSearchParams?.page ?? "1";

  const pageParam = Number(pageParamValue);
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const sortKey = ["title", "status", "variants", "category", "updatedAt"].includes(rawSort)
    ? (rawSort as "title" | "status" | "variants" | "category" | "updatedAt")
    : "updatedAt";
  const sortDirection = rawDir === "asc" ? "asc" : "desc";
  const storefrontFilter = parseStorefront(rawStorefront);

  const where: Prisma.ProductWhereInput = {
    ...(rawQuery
      ? {
          OR: [
            { title: { contains: rawQuery, mode: "insensitive" } },
            { handle: { contains: rawQuery, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(storefrontFilter ? { storefronts: { has: storefrontFilter } } : {}),
    ...(rawSupplier ? { supplierId: rawSupplier } : {}),
    ...(rawCategory
      ? {
          categories: {
            some: {
              categoryId: rawCategory,
            },
          },
        }
      : {}),
    ...(rawCollection
      ? {
          collections: {
            some: {
              collectionId: rawCollection,
            },
          },
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput[] = (() => {
    switch (sortKey) {
      case "title":
        return [{ title: sortDirection }, { updatedAt: "desc" }];
      case "status":
        return [{ status: sortDirection }, { updatedAt: "desc" }];
      case "variants":
        return [{ variants: { _count: sortDirection } }, { updatedAt: "desc" }];
      case "category":
        return [{ mainCategory: { name: sortDirection } }, { updatedAt: "desc" }];
      default:
        return [{ updatedAt: sortDirection }];
    }
  })();

  const totalCount = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const sortCategoryInMemory = sortKey === "category";

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [
    products,
    categories,
    collections,
    suppliers,
    performance30d,
    performance7d,
    returnItems,
    stockCoverageMap,
  ] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: sortCategoryInMemory ? [{ updatedAt: "desc" }] : orderBy,
      ...(sortCategoryInMemory
        ? {}
        : {
            take: PAGE_SIZE,
            skip: (currentPage - 1) * PAGE_SIZE,
          }),
      include: {
        _count: { select: { variants: true, images: true } },
        images: {
          take: 1,
          orderBy: { position: "asc" },
          select: { url: true, altText: true },
        },
        mainCategory: { select: { id: true, name: true, handle: true } },
        supplierRef: { select: { id: true, name: true } },
        categories: {
          orderBy: { position: "asc" },
          select: {
            categoryId: true,
            category: { select: { id: true, name: true, handle: true, parentId: true } },
          },
        },
        collections: {
          orderBy: { position: "asc" },
          select: {
            collectionId: true,
            collection: { select: { id: true, name: true, handle: true } },
          },
        },
        variants: {
          select: {
            id: true,
            inventory: { select: { quantityOnHand: true, reserved: true } },
          },
        },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.collection.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, leadTimeDays: true },
    }),
    getProductPerformance(30),
    getProductPerformance(7),
    prisma.returnItem.findMany({
      where: {
        request: {
          createdAt: { gte: thirtyDaysAgo },
        },
      },
      select: {
        quantity: true,
        orderItem: { select: { productId: true } },
      },
    }),
    getStockCoverageMap(30),
  ]);

  const performance30dMap = new Map(performance30d.map((row) => [row.productId, row]));
  const performance7dMap = new Map(performance7d.map((row) => [row.productId, row]));
  const visibleProducts = sortCategoryInMemory
    ? [...products]
        .sort((left, right) => {
          const leftCategoryName =
            left.mainCategory?.name ??
            left.categories.find((entry) => entry.category.parentId === null)?.category.name ??
            "";
          const rightCategoryName =
            right.mainCategory?.name ??
            right.categories.find((entry) => entry.category.parentId === null)?.category.name ??
            "";
          const byCategory = leftCategoryName.localeCompare(rightCategoryName, "de");
          if (byCategory !== 0) {
            return sortDirection === "asc" ? byCategory : -byCategory;
          }
          return right.updatedAt.getTime() - left.updatedAt.getTime();
        })
        .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
    : products;
  const returnedUnitsByProductId = new Map<string, number>();
  for (const item of returnItems) {
    const productId = item.orderItem.productId;
    if (!productId) continue;
    returnedUnitsByProductId.set(productId, (returnedUnitsByProductId.get(productId) ?? 0) + item.quantity);
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-2 py-2 text-slate-100">
      <AdminCatalogClient
        initialProducts={visibleProducts.map((product) => {
          const {
            variants,
            supplierRef,
            collections: productCollections,
            images,
            ...rest
          } = product;
          const availableInventory = variants.reduce((sum, variant) => {
            const inventory = variant.inventory;
            const onHand = inventory?.quantityOnHand ?? 0;
            const reserved = inventory?.reserved ?? 0;
            return sum + Math.max(0, onHand - reserved);
          }, 0);
          const aggregateDailyVelocity = variants.reduce((sum, variant) => {
            const coverage = stockCoverageMap.get(variant.id);
            return sum + (coverage?.dailyVelocity ?? 0);
          }, 0);
          const stockCoverDays =
            aggregateDailyVelocity > 0 ? availableInventory / aggregateDailyVelocity : null;
          const fallbackCategory =
            product.categories.find((entry) => entry.category.parentId === null)?.category ?? null;
          const insight30d = performance30dMap.get(product.id);
          const insight7d = performance7dMap.get(product.id);
          const trendBase =
            (insight30d?.views ?? 0) + (insight30d?.purchases ?? 0) * 5 + (insight30d?.revenueCents ?? 0) / 5_000;
          const recentTrendBase =
            (insight7d?.views ?? 0) + (insight7d?.purchases ?? 0) * 5 + (insight7d?.revenueCents ?? 0) / 5_000;
          const trendDeltaRatio =
            trendBase > 0 ? recentTrendBase / Math.max(trendBase / 30 * 7, 1) - 1 : recentTrendBase > 0 ? 1 : 0;
          const trendDirection =
            trendDeltaRatio >= 0.35
              ? "trending"
              : trendDeltaRatio <= -0.25 && (insight30d?.views ?? 0) >= 20
                ? "cooling"
                : "steady";
          const returnedUnits30d = returnedUnitsByProductId.get(product.id) ?? 0;
          const purchases30d = insight30d?.purchases ?? 0;
          const revenue30dCents = insight30d?.revenueCents ?? 0;
          const margin30dCents = insight30d?.marginCents ?? 0;

          return {
            ...rest,
            createdAt: product.createdAt.toISOString(),
            updatedAt: product.updatedAt.toISOString(),
            outOfStock: availableInventory <= 0,
            availableInventory,
            imageUrl: images[0]?.url ?? null,
            imageAlt: images[0]?.altText ?? product.title,
            supplierId: supplierRef?.id ?? null,
            supplierName: supplierRef?.name ?? null,
            storefronts: product.storefronts,
            categoryIds: product.categories.map((entry) => entry.categoryId),
            collectionIds: productCollections.map((entry) => entry.collectionId),
            mainCategory: product.mainCategory ?? fallbackCategory ?? null,
            insights: {
              views30d: insight30d?.views ?? 0,
              addToCart30d: insight30d?.addToCart ?? 0,
              beginCheckout30d: insight30d?.beginCheckout ?? 0,
              purchases30d,
              revenue30dCents,
              margin30dCents,
              marginRate30d: revenue30dCents > 0 ? margin30dCents / revenue30dCents : 0,
              conversionRate30d: insight30d?.conversionRate ?? 0,
              addToCartRate30d: insight30d?.addToCartRate ?? 0,
              returnedUnits30d,
              returnRate30d: purchases30d > 0 ? returnedUnits30d / purchases30d : 0,
              stockCoverDays,
              trendDirection,
              trendDeltaRatio,
            },
          };
        })}
        initialQuery={rawQuery}
        initialSortKey={sortKey}
        initialSortDirection={sortDirection}
        totalCount={totalCount}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        initialCategories={categories}
        initialCollections={collections}
        initialSuppliers={suppliers}
        initialFilters={{
          storefront: storefrontFilter ?? "",
          supplierId: rawSupplier,
          categoryId: rawCategory,
          collectionId: rawCollection,
        }}
      />
    </div>
  );
}
