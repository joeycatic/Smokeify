import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import { getProducts } from "@/lib/catalog";
import { seoPageBySlug, seoPages, type SeoPageConfig } from "@/lib/seoPages";
import SeoProductsClient from "./SeoProductsClient";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

const getConfig = (slugParts: string[]) => {
  return seoPageBySlug.get(slugParts.join("/")) ?? null;
};

const matchesCategory = (config: SeoPageConfig, handle: string, parent?: string) => {
  const normalizedHandle = handle.toLowerCase();
  const normalizedParent = parent?.toLowerCase() ?? null;
  if (config.subcategoryHandle) {
    const directMatch = normalizedHandle === config.subcategoryHandle;
    const prefixedMatch =
      config.parentHandle &&
      normalizedHandle === `${config.parentHandle}-${config.subcategoryHandle}`;
    const singularPrefixedMatch =
      config.parentHandle &&
      config.parentHandle.endsWith("en") &&
      normalizedHandle ===
        `${config.parentHandle.slice(0, -2)}-${config.subcategoryHandle}`;
    if (!directMatch && !prefixedMatch && !singularPrefixedMatch) return false;
    if (config.parentHandle) {
      return normalizedParent === config.parentHandle;
    }
    return true;
  }
  if (!config.categoryHandle) return false;
  if (normalizedHandle === config.categoryHandle) return true;
  return normalizedParent === config.categoryHandle;
};

const sizeKeyFrom = (value?: string | null) => {
  if (!value) return null;
  const matches = value.match(/(\d+(?:[.,]\d+)?)/g);
  if (!matches || matches.length < 2) return null;
  const numbers = matches
    .map((match) => Number(match.replace(",", ".")))
    .filter((num) => Number.isFinite(num));
  if (numbers.length < 2) return null;
  return `${numbers[0]}x${numbers[1]}`;
};

const filterProductsForConfig = (config: SeoPageConfig) => {
  return (product: Awaited<ReturnType<typeof getProducts>>[number]) => {
    const matchesCategoryFilter =
      product.categories?.some((category) =>
        matchesCategory(
          config,
          category.handle,
          category.parent?.handle ?? undefined,
        ),
      ) ?? false;
    if (!matchesCategoryFilter) return false;
    if (config.growboxSize) {
      return sizeKeyFrom(product.growboxSize) === config.growboxSize;
    }
    return true;
  };
};

export async function generateStaticParams() {
  return seoPages.map((page) => ({ slug: page.slugParts }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = getConfig(slug);
  if (!config) return {};
  return {
    title: `${config.title} | Smokeify`,
    description: config.description,
  };
}

export default async function SeoCategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const config = getConfig(slug);
  if (!config) return notFound();

  const products = await getProducts(500);
  const filtered = products.filter(filterProductsForConfig(config));
  const growboxSizes = ["60x60", "80x80", "100x100", "120x120", "150x150", "200x200"];
  const showGrowboxSizeLinks =
    config.categoryHandle === "growboxen" || config.growboxSize;
  const sizeLinks = showGrowboxSizeLinks
    ? [
        {
          label: "Alle Größen",
          href: "/growboxen",
          active: !config.growboxSize,
        },
        ...growboxSizes.map((size) => ({
          label: size,
          href: `/growboxen-${size}`,
          active: config.growboxSize === size,
        })),
      ]
    : [];

  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-2 sm:px-6">
        <section className="mt-2">
          <SeoProductsClient
            initialProducts={filtered}
            title={config.title}
            subtitle={config.description}
            sizeLinks={sizeLinks}
          />
        </section>
      </main>
    </PageLayout>
  );
}
