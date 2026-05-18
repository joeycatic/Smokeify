import type { Metadata } from "next";

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
  return children;
}
