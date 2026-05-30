import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageLayout commerce={false}>{children}</PageLayout>;
}
