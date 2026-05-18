"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import type { NavbarCategory } from "@/lib/navbarCategories";

const NavbarCategoriesContext = createContext<NavbarCategory[]>([]);

export function NavbarCategoriesProvider({
  children,
  categories,
}: {
  children: ReactNode;
  categories: NavbarCategory[];
}) {
  return (
    <NavbarCategoriesContext.Provider value={categories}>
      {children}
    </NavbarCategoriesContext.Provider>
  );
}

export function useNavbarCategories() {
  return useContext(NavbarCategoriesContext);
}
