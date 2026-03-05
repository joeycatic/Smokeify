"use client";

import { SessionProvider } from "next-auth/react";
import CookieConsent from "@/components/CookieConsent";
import GTMTag from "@/components/GTMTag";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <GTMTag />
      <CookieConsent />
    </SessionProvider>
  );
}
