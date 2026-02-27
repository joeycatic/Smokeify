"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/components/CartProvider";
import CookieConsent from "@/components/CookieConsent";
import GTMTag from "@/components/GTMTag";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        {children}
        <GTMTag />
        <CookieConsent />
      </CartProvider>
    </SessionProvider>
  );
}
