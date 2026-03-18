"use client";

import { SessionProvider } from "next-auth/react";
import CommerceProviders from "@/components/CommerceProviders";
import NewsletterOfferPopup from "@/components/NewsletterOfferPopup";
import {
  NavbarCategoriesProvider,
} from "@/components/NavbarCategoriesProvider";
import type { NavbarCategory } from "@/lib/navbarCategories";

export default function CommerceProvidersShell({
  children,
  initialNavbarCategories,
}: {
  children: React.ReactNode;
  initialNavbarCategories: NavbarCategory[];
}) {
  return (
    <SessionProvider>
      <NavbarCategoriesProvider categories={initialNavbarCategories}>
        <CommerceProviders>{children}</CommerceProviders>
      </NavbarCategoriesProvider>
      <NewsletterOfferPopup />
    </SessionProvider>
  );
}

