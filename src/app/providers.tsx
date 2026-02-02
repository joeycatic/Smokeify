"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/components/CartProvider";
import CookieConsent from "@/components/CookieConsent";
import AgeGate from "@/components/AgeGate";
import GoogleTag from "@/components/GoogleTag";
import GTMTag from "@/components/GTMTag";

export default function Providers({ children }: { children: React.ReactNode }) {
  const hasGtm = Boolean(process.env.NEXT_PUBLIC_GTM_ID);
  return (
    <SessionProvider>
      <CartProvider>
        {children}
        {hasGtm ? <GTMTag /> : <GoogleTag />}
        <AgeGate />
        <CookieConsent />
      </CartProvider>
    </SessionProvider>
  );
}
