"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/components/CartProvider";
import { WishlistProvider } from "@/hooks/useWishlist";

export default function CommerceProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WishlistProvider>
      <CartProvider>{children}</CartProvider>
    </WishlistProvider>
  );
}
