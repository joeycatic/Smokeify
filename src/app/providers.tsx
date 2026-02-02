"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/components/CartProvider";
import CookieConsent from "@/components/CookieConsent";
import AgeGate from "@/components/AgeGate";
import GoogleTag from "@/components/GoogleTag";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        {children}
        <GoogleTag />
        <AgeGate />
        <CookieConsent />
      </CartProvider>
    </SessionProvider>
  );
}
