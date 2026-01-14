// src/app/layout.tsx
import type { Metadata } from "next";
import Providers from "@/app/providers";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "Smokeify",
    template: "%s | Smokeify",
  },
  description: "Modern grow equipment",
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: siteUrl,
    title: "Smokeify",
    description: "Modern grow equipment",
    siteName: "Smokeify",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smokeify",
    description: "Modern grow equipment",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
