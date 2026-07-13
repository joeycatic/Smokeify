import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import CompareProductsClient from "./CompareProductsClient";

export const metadata: Metadata = {
  title: "Produkte vergleichen",
  description: "Smokeify Produkte anhand der wichtigsten Kaufkriterien vergleichen.",
  robots: { index: false, follow: true },
};

export default function CompareProductsPage() {
  return (
    <PageLayout commerce>
      <CompareProductsClient />
    </PageLayout>
  );
}
