import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminThemeProvider } from "@/components/admin/AdminThemeProvider";
import { authOptions } from "@/lib/auth";

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

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "ADMIN") {
    notFound();
  }

  return <AdminThemeProvider>{children}</AdminThemeProvider>;
}
