"use client";

import { useEffect, useState } from "react";
import { useWishlist } from "@/hooks/useWishlist";
import type { Product } from "@/data/types";
import PageLayout from "@/components/PageLayout";
import { DisplayProductsList } from "@/components/DisplayProducts";

export default function WishlistPage() {
  const { ids } = useWishlist();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!ids.length) {
        setProducts([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });
        if (!res.ok) throw new Error("Wishlist fetch failed");
        const data = (await res.json()) as Product[];
        if (!cancelled) setProducts(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return (
    <PageLayout>
      <div className="mx-auto max-w-5xl px-6 py-10 text-black/80">
        <h1 className="text-3xl font-bold mb-6" style={{ color: "#2f3e36" }}>
          Wunschliste
        </h1>
        {loading && <p className="text-stone-600">Wunschliste wird geladen...</p>}
        {!loading && ids.length === 0 && (
          <p className="text-stone-600">Deine Wunschliste ist leer.</p>
        )}
        {!loading && ids.length > 0 && <DisplayProductsList products={products} />}
      </div>
    </PageLayout>
  );
}

