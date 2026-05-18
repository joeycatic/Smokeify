"use client";

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
    <NavbarCategoriesProvider categories={initialNavbarCategories}>
      {children}
      <NewsletterOfferPopup />
    </NavbarCategoriesProvider>
  );
}
