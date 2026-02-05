import type { Metadata } from "next";

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

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
