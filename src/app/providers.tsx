"use client";

import { SessionProvider } from "next-auth/react";
import CookieConsent from "@/components/CookieConsent";
import GTMTag from "@/components/GTMTag";
import CommerceProviders from "@/components/CommerceProviders";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CommerceProviders>{children}</CommerceProviders>
      <GTMTag />
      <CookieConsent />
    </SessionProvider>
  );
}
