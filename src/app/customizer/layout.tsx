import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";

export const metadata: Metadata = {
  title: "Pflanzenzelt-Konfigurator",
  description:
    "Pflanzenzelt-Konfigurator: Stelle dein Indoor-Setup aus Zelt, Licht, Abluft und Extras passend zusammen.",
  alternates: {
    canonical: "/customizer",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function CustomizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageLayout commerce>{children}</PageLayout>;
}
