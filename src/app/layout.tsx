// src/app/layout.tsx
import type { Metadata } from "next";
import Providers from "@/app/providers";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-fraunces",
});

export const metadata: Metadata = {
  title: {
    default: "Smokeify",
    template: "%s | Smokeify",
  },
  description: "Hochwertiges Equipment für Indoor-Gärten – Pflanzenleuchten, Lüftungssysteme, Bewässerung und mehr.",
  metadataBase: new URL(siteUrl),
  alternates: {
    languages: {
      "de-DE": "/",
      "x-default": "/",
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: siteUrl,
    title: "Smokeify",
    description: "Hochwertiges Equipment für Indoor-Gärten – Pflanzenleuchten, Lüftungssysteme, Bewässerung und mehr.",
    siteName: "Smokeify",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smokeify",
    description: "Hochwertiges Equipment für Indoor-Gärten – Pflanzenleuchten, Lüftungssysteme, Bewässerung und mehr.",
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
  icons: {
    icon: [
      { url: "/favicons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicons/favicon.ico" },
    ],
    apple: [{ url: "/favicons/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/favicons/site.webmanifest",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <head />
      <body
        className={`${manrope.variable} ${fraunces.variable} min-h-screen bg-[var(--smk-bg)] font-[family:var(--font-manrope)] text-[var(--smk-text)] antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
