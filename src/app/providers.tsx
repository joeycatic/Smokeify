"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/components/CartProvider";
import CookieConsent from "@/components/CookieConsent";
import GTMTag from "@/components/GTMTag";
import { WishlistProvider } from "@/hooks/useWishlist";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WishlistProvider>
        <CartProvider>
          {children}
          <GTMTag />
          <CookieConsent />
        </CartProvider>
      </WishlistProvider>
    </SessionProvider>
  );
}
