import type { Metadata } from "next";
import PageLayout from "@/components/PageLayout";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
};

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageLayout commerce>{children}</PageLayout>;
}
