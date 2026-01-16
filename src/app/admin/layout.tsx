import type { ReactNode } from "react";
import { AdminThemeProvider } from "@/components/admin/AdminThemeProvider";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminThemeProvider>{children}</AdminThemeProvider>;
}
