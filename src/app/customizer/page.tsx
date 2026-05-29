import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";
import CustomizerClient from "./CustomizerClient";

export const metadata: Metadata = {
  title: "Smokeify Konfigurator | Grow-Setup zusammenstellen",
  description:
    "Stelle dein Smokeify Grow-Setup aus Growbox, Licht, Abluft und Zubehör lokal zusammen.",
  alternates: {
    canonical: "/customizer",
  },
};

export default function CustomizerPage() {
  return (
    <PageLayout commerce>
      <CustomizerClient />
    </PageLayout>
  );
}
