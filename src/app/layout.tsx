// src/app/layout.tsx
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
      <body className="bg-stone-50 text-stone-900">
        {children}
      </body>
    </html>
  );
}
