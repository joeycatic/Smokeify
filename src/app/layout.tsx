// src/app/layout.tsx
import Providers from "@/app/providers";
import "./globals.css";

export const metadata = {
  title: "Smokeify",
  description: "Modern grow equipment",
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
