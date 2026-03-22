"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type AdminTheme = "light" | "dark";

type AdminThemeContextValue = {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
  toggleTheme: () => void;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const value: AdminThemeContextValue = {
    theme: "dark",
    setTheme: () => {},
    toggleTheme: () => {},
  };

  return (
    <AdminThemeContext.Provider value={value}>
      <div className="admin-theme admin-dark" data-admin-theme="dark">
        {children}
      </div>
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error("useAdminTheme must be used within AdminThemeProvider");
  }
  return context;
}
