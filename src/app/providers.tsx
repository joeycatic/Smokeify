"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/components/CartProvider";
import CookieConsent from "@/components/CookieConsent";
import AgeGate from "@/components/AgeGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        {children}
        <AgeGate />
        <CookieConsent />
      </CartProvider>
    </SessionProvider>
  );
}
