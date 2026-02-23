// app/products/page.tsx (Server Component)
import type { Metadata } from "next";
import { getProducts } from "@/lib/catalog";
import ProductsClient from "./ProductsClient";
import PageLayout from "@/components/PageLayout";

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

export default async function ProductsPage() {
  const products = await getProducts(500);
  
  return (
    <PageLayout>
      <ProductsClient initialProducts={products} />
    </PageLayout>
  );
}
