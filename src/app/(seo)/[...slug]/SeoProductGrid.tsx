"use client";

import { useEffect, useState } from "react";
import DisplayProducts from "@/components/DisplayProducts";
import type { Product } from "@/data/types";

type Props = {
  products: Product[];
};

export default function SeoProductGrid({ products }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return (
    <DisplayProducts
      products={products}
      cols={isMobile ? 2 : 4}
      showManufacturer
      titleLines={3}
      showGrowboxSize
      hideCartLabel={isMobile}
    />
  );
}
