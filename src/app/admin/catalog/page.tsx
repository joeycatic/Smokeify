import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageLayout from "@/components/PageLayout";
import AdminCatalogClient from "./AdminCatalogClient";

export default async function AdminCatalogPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) notFound();

  const [products, categories, collections] = await Promise.all([
    prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { variants: true, images: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.collection.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#2f3e36" }}>
            Catalog
          </h1>
          <p className="text-sm text-stone-600">
            Manage products, categories, and collections.
          </p>
        </div>
        <AdminCatalogClient
          initialProducts={products.map((product) => ({
            ...product,
            createdAt: product.createdAt.toISOString(),
            updatedAt: product.updatedAt.toISOString(),
          }))}
          initialCategories={categories}
          initialCollections={collections}
        />
      </div>
    </PageLayout>
  );
}
