import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import PlantAnalyzerClient from "./PlantAnalyzerClient";

export const metadata: Metadata = {
  title: "Pflanzenanalyse | Smokeify",
  description:
    "Lade ein Pflanzenfoto hoch und erhalte eine strukturierte Smokeify Analyse mit Prüfchecks, Pflegehinweisen und passenden Produkten.",
  alternates: {
    canonical: "/pflanzen-analyse",
  },
};

export default function PlantAnalyzerPage() {
  return (
    <PageLayout commerce>
      <PlantAnalyzerClient />
    </PageLayout>
  );
}
