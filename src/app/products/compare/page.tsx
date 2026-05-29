import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import CompareProductsClient from "./CompareProductsClient";

export const metadata: Metadata = {
  title: "Produktvergleich | Smokeify",
  description:
    "Vergleiche Smokeify Produkte nach Preis, Marke, Kategorie und Verfügbarkeit.",
  alternates: {
    canonical: "/products/compare",
  },
};

export default function CompareProductsPage() {
  return (
    <PageLayout commerce>
      <CompareProductsClient />
    </PageLayout>
  );
}
