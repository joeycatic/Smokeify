import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Growbox Konfigurator",
  description:
    "Growbox Konfigurator (Zelt Konfigurator): Stelle dein Setup aus Zelt, Licht, Abluft und Extras passend zusammen.",
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
  return children;
}
