import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { unstable_cache } from "next/cache";

// Recompute category tree + product counts at most once every 60 seconds.
// The recursive subtree computation is the expensive part — caching it
// eliminates the DB and CPU cost on every navigation request.
const getCategoriesWithCounts = unstable_cache(
  async () => {
    const [categories, productCategoryLinks, mainCategoryLinks] = await Promise.all([
      prisma.category.findMany({
        select: { id: true, name: true, handle: true, parentId: true },
        orderBy: { name: "asc" },
      }),
      prisma.productCategory.findMany({
        select: { productId: true, categoryId: true },
      }),
      prisma.product.findMany({
        select: { id: true, mainCategoryId: true },
        where: { mainCategoryId: { not: null } },
      }),
    ]);

    const categoryProducts = new Map<string, Set<string>>();
    const addProductToCategory = (categoryId: string, productId: string) => {
      const set = categoryProducts.get(categoryId) ?? new Set<string>();
      set.add(productId);
      categoryProducts.set(categoryId, set);
    };

    productCategoryLinks.forEach((link) => {
      addProductToCategory(link.categoryId, link.productId);
    });
    mainCategoryLinks.forEach((product) => {
      if (!product.mainCategoryId) return;
      addProductToCategory(product.mainCategoryId, product.id);
    });

    const childrenByParent = new Map<string | null, string[]>();
    categories.forEach((category) => {
      const key = category.parentId ? String(category.parentId) : null;
      const list = childrenByParent.get(key) ?? [];
      list.push(category.id);
      childrenByParent.set(key, list);
    });

    const subtreeCache = new Map<string, Set<string>>();
    const getSubtreeProducts = (categoryId: string): Set<string> => {
      const cached = subtreeCache.get(categoryId);
      if (cached) return cached;
      const set = new Set(categoryProducts.get(categoryId) ?? []);
      const children = childrenByParent.get(categoryId) ?? [];
      children.forEach((childId) => {
        const childSet = getSubtreeProducts(childId);
        childSet.forEach((productId) => set.add(productId));
      });
      subtreeCache.set(categoryId, set);
      return set;
    };

    return categories.map((category) => ({
      ...category,
      itemCount: categoryProducts.get(category.id)?.size ?? 0,
      totalItemCount: getSubtreeProducts(category.id).size,
    }));
  },
  ["api-categories"],
  { revalidate: 60 }
);

export async function GET(request: Request) {
  const ip = getClientIp(request.headers);
  const ipLimit = await checkRateLimit({
    key: `categories:ip:${ip}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!ipLimit.allowed) {
    return NextResponse.json({ categories: [] }, { status: 429 });
  }

  const categories = await getCategoriesWithCounts();
  return NextResponse.json({ categories });
}
