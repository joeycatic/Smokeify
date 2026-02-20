import type { MetadataRoute } from "next";
import { seoPages } from "@/lib/seoPages";
import { prisma } from "@/lib/prisma";

const GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES = new Set([
  "headshop",
  "aschenbecher",
  "aufbewahrung",
  "bongs",
  "feuerzeuge",
  "filter",
  "grinder",
  "kraeuterschale",
  "hash-bowl",
  "papers",
  "pipes",
  "rolling-tray",
  "tubes",
  "vaporizer",
  "waagen",
]);

const GOOGLE_FEED_FORCE_INCLUDE_HANDLES = new Set([
  "homebox-ambient-q-80-plus",
  "secret-jardin-hydro-shoot-100-grow-set-100-100-200-cm",
  "secret-jardin-hydro-shoot-100-grow-set-120-120-200-cm",
  "secret-jardin-hydro-shoot-60-grow-set-60-60-158-cm",
  "secret-jardin-hydro-shoot-80-grow-set-80-80-188-cm",
]);

const rawSiteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

const siteUrl = (() => {
  try {
    const url = new URL(rawSiteUrl);
    if (url.hostname === "smokeify.de") {
      url.hostname = "www.smokeify.de";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return rawSiteUrl;
  }
})();

const toUrl = (path: string) => `${siteUrl}${path}`;

const isNoindexSeoPage = (page: { slugParts: string[]; categoryHandle?: string; parentHandle?: string }) =>
  page.slugParts[0] === "headshop" ||
  page.categoryHandle === "headshop" ||
  page.parentHandle === "headshop";

const isNoindexProduct = (product: {
  handle: string;
  mainCategory: { handle: string; parent: { handle: string } | null } | null;
  categories: Array<{ category: { handle: string; parent: { handle: string } | null } }>;
}) => {
  const normalizedHandle = product.handle.toLowerCase();
  if (GOOGLE_FEED_FORCE_INCLUDE_HANDLES.has(normalizedHandle)) return false;

  const categoryHandles = [
    product.mainCategory?.handle ?? "",
    product.mainCategory?.parent?.handle ?? "",
    ...product.categories.map((entry) => entry.category.handle),
    ...product.categories.map((entry) => entry.category.parent?.handle ?? ""),
  ]
    .map((entry) => entry.toLowerCase())
    .filter(Boolean);

  return categoryHandles.some((handle) =>
    GOOGLE_FEED_EXCLUDED_CATEGORY_HANDLES.has(handle)
  );
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      handle: true,
      updatedAt: true,
      mainCategory: {
        select: { handle: true, parent: { select: { handle: true } } },
      },
      categories: {
        select: {
          category: { select: { handle: true, parent: { select: { handle: true } } } },
        },
      },
    },
    orderBy: { id: "asc" },
  });
  const productUrls = products
    .filter((product) => !isNoindexProduct(product))
    .map((product) => ({
      url: toUrl(`/products/${product.handle}`),
      lastModified: product.updatedAt,
    }));
  return [
    { url: toUrl("/"), lastModified: now },
    { url: toUrl("/products"), lastModified: now },
    { url: toUrl("/customizer"), lastModified: now },
    { url: toUrl("/bestseller"), lastModified: now },
    { url: toUrl("/neuheiten"), lastModified: now },
    ...seoPages
      .filter((page) => !isNoindexSeoPage(page))
      .map((page) => ({
      url: toUrl(`/${page.slugParts.join("/")}`),
      lastModified: now,
      })),
    ...productUrls,
  ];
}
