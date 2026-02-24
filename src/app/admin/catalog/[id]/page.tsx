import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminProductClient from "./AdminProductClient";

export default async function AdminProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const isAdminOrStaff =
    session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  if (!isAdminOrStaff) notFound();

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: {
        orderBy: { position: "asc" },
        include: { options: true, inventory: true },
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

  if (!product) notFound();

  const [categories, collections, suppliers, crossSells] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.collection.findMany({ orderBy: { name: "asc" } }),
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, leadTimeDays: true },
    }),
    prisma.productCrossSell
      ? prisma.productCrossSell.findMany({
          where: { productId: id },
          orderBy: { sortOrder: "asc" },
          include: {
            crossSell: {
              select: {
                id: true,
                title: true,
                handle: true,
                images: { take: 1, orderBy: { position: "asc" } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <AdminProductClient
          product={{
            ...product,
            createdAt: product.createdAt.toISOString(),
            updatedAt: product.updatedAt.toISOString(),
          }}
          categories={categories}
          collections={collections}
          suppliers={suppliers}
          crossSells={crossSells.map((row) => ({
            crossSell: {
              id: row.crossSell.id,
              title: row.crossSell.title,
              handle: row.crossSell.handle,
              imageUrl: row.crossSell.images[0]?.url ?? null,
            },
          }))}
        />
      </div>
    </PageLayout>
  );
}
