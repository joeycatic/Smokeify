import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminThemeProvider } from "@/components/admin/AdminThemeProvider";
import AdminShell from "@/components/admin/AdminShell";
import { hasAdminAccess } from "@/lib/adminAccess";
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
  if (
    !session?.user?.id ||
    !hasAdminAccess({
      role: session.user.role,
      adminVerifiedAt: session.user.adminVerifiedAt,
      adminAccessDisabledAt: session.user.adminAccessDisabledAt,
    })
  ) {
    redirect("/auth/admin?returnTo=/admin");
  }

  return (
    <AdminThemeProvider>
      <AdminShell userEmail={session.user.email ?? null}>{children}</AdminShell>
    </AdminThemeProvider>
  );
}
