// app/products/page.tsx (Server Component)
import type { Metadata } from "next";
import ProductsPageClient from "./ProductsPageClient";
import PageLayout from "@/components/PageLayout";
import { measureServerExecution } from "@/lib/perf";
import { queryProducts } from "@/lib/productsQuery";
import {
  filtersFromProductsUrlState,
  hasProductsUrlState,
  parseProductsUrlState,
} from "@/lib/productsUrlState";

export const revalidate = 30;
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const resolvedSearchParams = (await searchParams) ?? {};
  const hasUrlState = hasProductsUrlState(resolvedSearchParams);

  return {
    title: "Produkte",
    description: "Alle Produkte bei Smokeify entdecken.",
    alternates: {
      canonical: "/products",
      languages: {
        "de-DE": "/products",
        "x-default": "/products",
      },
    },
    robots: hasUrlState ? { index: false, follow: true } : undefined,
    openGraph: {
      url: `${siteUrl}/products`,
      title: "Produkte | Smokeify",
      description: "Alle Produkte bei Smokeify entdecken.",
    },
    twitter: {
      title: "Produkte | Smokeify",
      description: "Alle Produkte bei Smokeify entdecken.",
    },
  };
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const urlState = parseProductsUrlState(resolvedSearchParams);
  const filters = filtersFromProductsUrlState(urlState, {
    priceMinBound: 0,
    priceMaxBound: Number.MAX_SAFE_INTEGER,
  });

  const { result: initialData } = await measureServerExecution(
    "page.products",
    () =>
      queryProducts({
        categoryParam: urlState.category,
        manufacturerParam: urlState.manufacturer,
        categories: filters.categories,
        manufacturers: filters.manufacturers,
        priceMin: urlState.priceMin,
        priceMax: urlState.priceMax,
        searchQuery: urlState.searchQuery,
        offset: 0,
        limit: 24,
        sortBy: urlState.sortBy,
      }),
  );

  return (
    <PageLayout commerce>
      <ProductsPageClient initialData={initialData} initialUrlState={urlState} />
    </PageLayout>
  );
}
