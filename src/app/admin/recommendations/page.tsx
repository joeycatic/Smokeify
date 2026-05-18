import { notFound } from "next/navigation";
import { requireAdminScope } from "@/lib/adminCatalog";
import { prisma } from "@/lib/prisma";
import AdminRecommendationsClient from "./AdminRecommendationsClient";

export default async function AdminRecommendationsPage() {
  if (!(await requireAdminScope("pricing.review"))) notFound();

  const [rules, categories, products] = await Promise.all([
    prisma.recommendationRule.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, handle: true },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { productGroup: true, tags: true },
    }),
  ]);

  const productGroups = Array.from(
    new Set(
      products
        .map((product) => product.productGroup?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const tags = Array.from(
    new Set(
      products
        .flatMap((product) => product.tags ?? [])
        .map((tag) => tag.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return (
    <AdminRecommendationsClient
      initialRules={rules.map((rule) => ({
        ...rule,
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      }))}
      categories={categories}
      productGroups={productGroups}
      tags={tags}
    />
  );
}
