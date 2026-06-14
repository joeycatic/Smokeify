import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import AdminShell from "@/components/admin/AdminShell";
import { hasAdminAccess } from "@/lib/adminAccess";
import { buildAdminLoginPath } from "@/lib/adminReturnTo";
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
  const requestHeaders = await headers();
  if (
    !session?.user?.id ||
    !hasAdminAccess({
      role: session.user.role,
      adminVerifiedAt: session.user.adminVerifiedAt,
      adminAccessDisabledAt: session.user.adminAccessDisabledAt,
    })
  ) {
    redirect(buildAdminLoginPath(requestHeaders.get("x-admin-return-to")));
  }

  return (
    <AdminShell userEmail={session.user.email ?? null} userRole={session.user.role}>
      {children}
    </AdminShell>
  );
}
