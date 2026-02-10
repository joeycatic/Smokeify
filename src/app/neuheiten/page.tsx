import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import ProductsClient from "@/app/products/ProductsClient";
import { getProducts, getProductsByIds } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";

export const metadata: Metadata = {
  title: "Neuheiten",
  description: "Neu eingetroffene Produkte bei Smokeify.",
  alternates: {
    canonical: "/neuheiten",
    languages: {
      "de-DE": "/neuheiten",
      "x-default": "/neuheiten",
    },
  },
  openGraph: {
    url: `${siteUrl}/neuheiten`,
    title: "Neuheiten | Smokeify",
    description: "Neu eingetroffene Produkte bei Smokeify.",
  },
  twitter: {
    title: "Neuheiten | Smokeify",
    description: "Neu eingetroffene Produkte bei Smokeify.",
  },
};

export default async function NeuheitenPage() {
  const newestIds = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 120,
    select: { id: true },
  });

  const orderedIds = newestIds.map((item) => item.id);
  const newestProducts = orderedIds.length ? await getProductsByIds(orderedIds) : [];
  const inStockNewest = newestProducts.filter((product) => product.availableForSale);

  const products =
    inStockNewest.length > 0
      ? inStockNewest
      : (await getProducts(120)).filter((product) => product.availableForSale);

  return (
    <PageLayout>
      <ProductsClient
        initialProducts={products}
        headerTitle="Unsere Neuheiten"
        headerDescription="Entdecke unsere neuesten Produkte und frisch eingetroffenen Artikel."
      />
    </PageLayout>
  );
}
