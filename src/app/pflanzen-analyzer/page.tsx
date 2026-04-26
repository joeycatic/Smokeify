import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import PlantAnalyzerClient from "./PlantAnalyzerClient";

export const metadata: Metadata = {
  title: "Pflanzen Analyse | Smokeify",
  description:
    "Foto hochladen, einfache Pflanzenanalyse erhalten und direkt passende Produkte und Guides von Smokeify entdecken.",
  alternates: {
    canonical: "/pflanzen-analyzer",
  },
  openGraph: {
    title: "Pflanzen Analyse | Smokeify",
    description:
      "Schnelle Pflanzenanalyse mit Foto-Upload, Problemschätzung und passenden Shop-Empfehlungen.",
  },
  twitter: {
    title: "Pflanzen Analyse | Smokeify",
    description:
      "Schnelle Pflanzenanalyse mit Foto-Upload, Problemschätzung und passenden Shop-Empfehlungen.",
  },
};

export default function PlantAnalyzerPage() {
  return (
    <PageLayout>
      <div className="smk-storefront-legacy smk-analyzer-scope brand-page-bg overflow-x-clip">
        <div className="mx-auto max-w-7xl px-3 pb-10 pt-4 sm:px-6 sm:pb-12 sm:pt-6">
          <PlantAnalyzerClient />
        </div>
      </div>
    </PageLayout>
  );
}
