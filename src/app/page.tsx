import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import { CategoryGrid } from "@/components/landing/CategoryGrid";
import { HeroSection } from "@/components/landing/HeroSection";
import { LegacyStorefrontSections } from "@/components/landing/LegacyStorefrontSections";
import { SocialProofBar } from "@/components/landing/SocialProofBar";
import {
  socialProof,
  type CategoryCard,
} from "@/components/landing/data/landingPageData";
import type { Product } from "@/data/types";
import { requireAdmin } from "@/lib/adminCatalog";
import { getGrowTentHotspotProducts } from "@/lib/growTentHotspotProducts";
import { resolveLandingPageProductSections } from "@/lib/landingPageConfig";
import { getNavbarCategories } from "@/lib/navbarCategories";
import { SITE_NAME, buildAbsoluteUrl } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: {
    absolute: "Smokeify — Equipment ohne Rätselraten",
  },
  description:
    "Smokeify hilft dir, Equipment klar auszuwählen: aktive Produkte, transparente Preise und ein Checkout ohne Konto.",
  alternates: {
    canonical: "/",
    languages: {
      "de-DE": "/",
      "x-default": "/",
    },
  },
};

function pickUniqueProducts(
  groups: Product[][],
  limit: number,
  excludedIds = new Set<string>(),
) {
  const seen = new Set(excludedIds);
  const products: Product[] = [];

  for (const product of groups.flat()) {
    if (!product?.id || seen.has(product.id)) continue;
    seen.add(product.id);
    products.push(product);
    if (products.length >= limit) break;
  }

  return products;
}
const CATEGORY_TONES = ["moss", "clay", "sky"] as const;

export default async function StorePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const previewValue = resolvedSearchParams?.landingPreview;
  const previewRequested =
    (Array.isArray(previewValue) ? previewValue[0] : previewValue) === "draft";
  const canPreviewDraft = previewRequested && Boolean(await requireAdmin());

  const [homepageProducts, navbarCategories, growTentProducts] = await Promise.all([
    resolveLandingPageProductSections("MAIN", {
      previewDraft: canPreviewDraft,
    }),
    getNavbarCategories(),
    getGrowTentHotspotProducts(),
  ]);

  const showcasedProducts = pickUniqueProducts(
    [
      homepageProducts.bestSellerProducts,
      homepageProducts.heroProducts,
      homepageProducts.tentProducts,
    ],
    4,
  );
  const secondaryProducts = pickUniqueProducts(
    [
      homepageProducts.tentProducts,
      homepageProducts.bestSellerProducts,
      homepageProducts.heroProducts,
    ],
    4,
    new Set(showcasedProducts.map((product) => product.id)),
  );
  const categories: CategoryCard[] = navbarCategories
    .filter((category) => !category.parentId && category.totalItemCount > 0)
    .sort((left, right) => right.totalItemCount - left.totalItemCount)
    .slice(0, 8)
    .map((category, index) => ({
      name: category.name,
      count: category.totalItemCount,
      href: category.href,
      highlighted: index === 0,
      tone: CATEGORY_TONES[index % CATEGORY_TONES.length],
    }));

  const homepageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${SITE_NAME} Landingpage`,
    description:
      "Aktive MAIN-Produkte, Kategorien und Entscheidungshilfen bei Smokeify.",
    url: buildAbsoluteUrl("/"),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: showcasedProducts.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.title,
        url: buildAbsoluteUrl(`/products/${product.handle}`),
        image: product.featuredImage?.url ?? undefined,
      })),
    },
  };

  return (
    <PageLayout commerce>
      <main className="space-y-8 pb-14 pt-4 text-[color:var(--gv-text)] sm:space-y-10 sm:pb-20 sm:pt-6 lg:space-y-12">
        {canPreviewDraft ? (
          <div className="rounded-[22px] border border-[#2f6690]/25 bg-[color:var(--gv-sky-soft)] px-4 py-3 text-sm font-semibold text-[#234f6a]">
            Admin-Vorschau aktiv: Du siehst den unveröffentlichten Stand der
            Smokeify-Homepage.
          </div>
        ) : null}
        <HeroSection growTentProducts={growTentProducts} />
        <CategoryGrid categories={categories} />
        <SocialProofBar proof={socialProof} />
        <LegacyStorefrontSections
          featuredLightDeals={secondaryProducts}
          showcasedProducts={showcasedProducts}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageSchema) }}
        />
      </main>
    </PageLayout>
  );
}
