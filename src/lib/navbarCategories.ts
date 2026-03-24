import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { seoPages } from "@/lib/seoPages";

export type NavbarCategory = {
  id: string;
  name: string;
  handle: string;
  parentId: string | null;
  href: string;
  itemCount: number;
  totalItemCount: number;
};

const buildCategoryHref = (handle: string) =>
  `/products?category=${encodeURIComponent(handle)}`;

const buildSeoSlugByKey = () => {
  const seoSlugByKey = new Map<string, string>();
  const addSeoKey = (key: string, slug: string) => {
    const normalized = key.trim().toLowerCase();
    if (!normalized || seoSlugByKey.has(normalized)) return;
    seoSlugByKey.set(normalized, slug);
  };

  seoPages.forEach((page) => {
    const slug = `/${page.slugParts.join("/")}`;
    if (page.slugParts.length === 1) {
      addSeoKey(page.slugParts[0], slug);
      addSeoKey(page.categoryHandle ?? "", slug);
      (page.categoryHandleAliases ?? []).forEach((alias) => addSeoKey(alias, slug));
    }
    if (page.slugParts.length === 2) {
      const parent = page.slugParts[0];
      const child = page.slugParts[1];
      addSeoKey(`${parent}/${child}`, slug);
      addSeoKey(`${parent}-${child}`, slug);
      if (page.parentHandle && page.subcategoryHandle) {
        addSeoKey(`${page.parentHandle}/${page.subcategoryHandle}`, slug);
        addSeoKey(`${page.parentHandle}-${page.subcategoryHandle}`, slug);
        (page.subcategoryHandleAliases ?? []).forEach((alias) => {
          addSeoKey(`${page.parentHandle}/${alias}`, slug);
          addSeoKey(`${page.parentHandle}-${alias}`, slug);
        });
      }
      if (parent.endsWith("en")) {
        const singular = parent.slice(0, -2);
        if (singular) {
          addSeoKey(`${singular}/${child}`, slug);
          addSeoKey(`${singular}-${child}`, slug);
        }
      }
    }
  });

  return seoSlugByKey;
};

const getNavbarCategoriesCached = unstable_cache(
  async (): Promise<NavbarCategory[]> => {
    const [categories, productCategoryLinks, mainCategoryLinks] = await Promise.all([
      prisma.category.findMany({
        where: { storefronts: { has: "MAIN" } },
        select: { id: true, name: true, handle: true, parentId: true },
        orderBy: { name: "asc" },
      }),
      prisma.productCategory.findMany({
        where: { product: { storefronts: { has: "MAIN" }, status: "ACTIVE" } },
        select: { productId: true, categoryId: true },
      }),
      prisma.product.findMany({
        select: { id: true, mainCategoryId: true },
        where: {
          mainCategoryId: { not: null },
          storefronts: { has: "MAIN" },
          status: "ACTIVE",
        },
      }),
    ]);
    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const seoSlugByKey = buildSeoSlugByKey();

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
      href: (() => {
        const normalizedHandle = category.handle.trim().toLowerCase();
        const parentHandle = category.parentId
          ? categoryById.get(category.parentId)?.handle?.trim().toLowerCase() ?? null
          : null;
        if (parentHandle) {
          const directSlug = seoSlugByKey.get(`${parentHandle}/${normalizedHandle}`);
          if (directSlug) return directSlug;
          if (normalizedHandle.startsWith(`${parentHandle}-`)) {
            const strippedHandle = normalizedHandle.slice(parentHandle.length + 1);
            const strippedSlug = seoSlugByKey.get(
              `${parentHandle}/${strippedHandle}`,
            );
            if (strippedSlug) return strippedSlug;
          }
        }
        return seoSlugByKey.get(normalizedHandle) ?? buildCategoryHref(category.handle);
      })(),
      itemCount: categoryProducts.get(category.id)?.size ?? 0,
      totalItemCount: getSubtreeProducts(category.id).size,
    }));
  },
  ["navbar-categories"],
  { revalidate: 60 },
);

export async function getNavbarCategories(): Promise<NavbarCategory[]> {
  return getNavbarCategoriesCached();
}
