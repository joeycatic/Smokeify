"use client";

import type { ReactNode } from "react";
import { CartProvider } from "@/components/CartProvider";
import { ProductCompareProvider } from "@/hooks/useProductCompare";
import { WishlistProvider } from "@/hooks/useWishlist";

export default function CommerceProviders({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WishlistProvider>
      <ProductCompareProvider>
        <CartProvider>{children}</CartProvider>
      </ProductCompareProvider>
    </WishlistProvider>
  );
}
