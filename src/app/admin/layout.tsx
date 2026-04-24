import type { ReactNode } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { AdminThemeProvider } from "@/components/admin/AdminThemeProvider";
import AdminShell from "@/components/admin/AdminShell";
import { hasAdminAccess } from "@/lib/adminAccess";
import { authOptions } from "@/lib/auth";
import { hasAdminScope, type AdminScope } from "@/lib/adminPermissions";

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
  const requestHeaders = await headers();
  const requiredScope = requestHeaders.get("x-admin-required-scope") as AdminScope | null;
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

  if (requiredScope && !hasAdminScope(session.user.role, requiredScope)) {
    redirect("/admin");
  }

  return (
    <AdminThemeProvider>
      <AdminShell userEmail={session.user.email ?? null} userRole={session.user.role}>
        {children}
      </AdminShell>
    </AdminThemeProvider>
  );
}
