import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminCatalogClient from "./AdminCatalogClient";

const PAGE_SIZE = 25;
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string | string[]; q?: string | string[] }>;
}) {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  const resolvedSearchParams = await searchParams;
  const rawQuery = Array.isArray(resolvedSearchParams?.q)
    ? resolvedSearchParams?.q[0] ?? ""
    : resolvedSearchParams?.q ?? "";
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

  const totalCount = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);

  const [products, categories, collections, suppliers] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
      include: {
        _count: { select: { variants: true, images: true } },
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
            return {
              ...rest,
              createdAt: product.createdAt.toISOString(),
              updatedAt: product.updatedAt.toISOString(),
              outOfStock: available <= 0,
            };
          })}
          initialQuery={rawQuery}
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
