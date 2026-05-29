"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import NewsletterOfferPopup from "@/components/NewsletterOfferPopup";
import {
  NavbarCategoriesProvider,
} from "@/components/NavbarCategoriesProvider";
import type { NavbarCategory } from "@/lib/navbarCategories";

const CompareTray = dynamic(() => import("@/components/CompareTray"), {
  ssr: false,
});

export default function CommerceProvidersShell({
  children,
  initialNavbarCategories,
}: {
  children: React.ReactNode;
  initialNavbarCategories: NavbarCategory[];
}) {
  const [deferredUiReady, setDeferredUiReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDeferredUiReady(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <NavbarCategoriesProvider categories={initialNavbarCategories}>
      {children}
      {deferredUiReady ? <CompareTray /> : null}
      <NewsletterOfferPopup />
    </NavbarCategoriesProvider>
  );
}
