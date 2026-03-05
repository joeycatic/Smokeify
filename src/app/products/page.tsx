// app/products/page.tsx (Server Component)
import type { Metadata } from "next";
import ProductsPageClient from "./ProductsPageClient";
import PageLayout from "@/components/PageLayout";
import { queryProducts } from "@/lib/productsQuery";

export const revalidate = 30;
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

export const metadata: Metadata = {
  title: "Produkte",
  description: "Alle Produkte bei Smokeify entdecken.",
  alternates: {
    canonical: "/products",
    languages: {
      "de-DE": "/products",
      "x-default": "/products",
    },
  },
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

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProductsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const categoryParam = Array.isArray(resolvedSearchParams.category)
    ? resolvedSearchParams.category[0] ?? ""
    : (resolvedSearchParams.category ?? "");
  const manufacturerParam = Array.isArray(resolvedSearchParams.manufacturer)
    ? resolvedSearchParams.manufacturer[0] ?? ""
    : (resolvedSearchParams.manufacturer ?? "");

  const initialData = await queryProducts({
    categoryParam,
    manufacturerParam,
    offset: 0,
    limit: 24,
    sortBy: "featured",
  });

  return (
    <PageLayout commerce>
      <ProductsPageClient initialData={initialData} />
    </PageLayout>
  );
}
