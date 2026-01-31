import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import PageLayout from "@/components/PageLayout";
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
  }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdminOrStaff =
    session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  if (!isAdminOrStaff) notFound();

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
  const pageParamValue = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams?.page[0] ?? "1"
    : resolvedSearchParams?.page ?? "1";
  const pageParam = Number(pageParamValue);
  const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const where = rawQuery
    ? {
        OR: [
          { title: { contains: rawQuery, mode: "insensitive" as const } },
          { handle: { contains: rawQuery, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const sortKey = ["title", "status", "variants", "category", "updatedAt"].includes(
    rawSort
  )
    ? (rawSort as "title" | "status" | "variants" | "category" | "updatedAt")
    : "updatedAt";
  const sortDirection = rawDir === "asc" ? "asc" : "desc";
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

  if (sortKey === "category") {
    const candidates = await prisma.product.findMany({
      where: { mainCategoryId: null, categories: { some: {} } },
      select: {
        id: true,
        categories: {
          orderBy: { position: "asc" },
          select: { categoryId: true, category: { select: { parentId: true } } },
        },
      },
    });
    const updates = candidates
      .map((product) => {
        const parentEntry = product.categories.find(
          (entry) => entry.category.parentId === null
        );
        return {
          id: product.id,
          categoryId: parentEntry?.categoryId ?? null,
        };
      })
      .filter((entry) => entry.categoryId);
    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((entry) =>
          prisma.product.update({
            where: { id: entry.id },
            data: { mainCategoryId: entry.categoryId },
          })
        )
      );
    }
  }

  const [products, categories, collections, suppliers] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
      include: {
        _count: { select: { variants: true, images: true } },
        mainCategory: { select: { id: true, name: true, handle: true } },
        categories: {
          orderBy: { position: "asc" },
          select: {
            category: { select: { id: true, name: true, handle: true, parentId: true } },
          },
        },
        variants: {
          select: {
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
  ]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <AdminCatalogClient
          initialProducts={products.map((product) => {
            const { variants, ...rest } = product;
            const available = variants.reduce((sum, variant) => {
              const inventory = variant.inventory;
              const onHand = inventory?.quantityOnHand ?? 0;
              const reserved = inventory?.reserved ?? 0;
              return sum + Math.max(0, onHand - reserved);
            }, 0);
            const fallbackCategory =
              product.categories.find((entry) => entry.category.parentId === null)
                ?.category ?? null;
            return {
              ...rest,
              createdAt: product.createdAt.toISOString(),
              updatedAt: product.updatedAt.toISOString(),
              outOfStock: available <= 0,
              mainCategory: product.mainCategory ?? fallbackCategory ?? null,
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
        />
      </div>
    </PageLayout>
  );
}
