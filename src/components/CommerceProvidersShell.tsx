"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  NavbarCategoriesProvider,
} from "@/components/NavbarCategoriesProvider";
import type { NavbarCategory } from "@/lib/navbarCategories";

const NewsletterOfferPopup = dynamic(
  () => import("@/components/NewsletterOfferPopup"),
  { ssr: false },
);

export default function CommerceProvidersShell({
  children,
  initialNavbarCategories,
}: {
  children: React.ReactNode;
  initialNavbarCategories: NavbarCategory[];
}) {
  const [canShowOffer, setCanShowOffer] = useState(false);

  useEffect(() => {
    const browserWindow = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (
          callback: IdleRequestCallback,
          options?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (handle: number) => void;
      };
    let idleId: number | null = null;

    const timeoutId = window.setTimeout(() => {
      if (typeof browserWindow.requestIdleCallback === "function") {
        idleId = browserWindow.requestIdleCallback(
          () => setCanShowOffer(true),
          { timeout: 2200 },
        );
        return;
      }
      setCanShowOffer(true);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== null) {
        browserWindow.cancelIdleCallback?.(idleId);
      }
    };
  }, []);

  return (
    <NavbarCategoriesProvider categories={initialNavbarCategories}>
      {children}
      {canShowOffer ? <NewsletterOfferPopup /> : null}
    </NavbarCategoriesProvider>
  );
}
