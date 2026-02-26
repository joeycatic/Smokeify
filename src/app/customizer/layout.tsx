import type { Metadata } from "next";

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
  return children;
}
