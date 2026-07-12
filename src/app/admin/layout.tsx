import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import AdminShell from "@/components/admin/AdminShell";
import { hasAdminAccess } from "@/lib/adminAccess";
import { buildAdminLoginPath } from "@/lib/adminReturnTo";
import { authOptions } from "@/lib/auth";

const adminSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
});

const adminMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
});

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
    <AdminShell
      userEmail={session.user.email ?? null}
      userRole={session.user.role}
      fontClassName={adminSans.className}
      monoFontClassName={adminMono.className}
    >
      {children}
    </AdminShell>
  );
}
