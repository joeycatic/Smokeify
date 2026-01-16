"use client";

import { useAdminTheme } from "./AdminThemeProvider";

export default function AdminThemeToggle() {
  const { theme, toggleTheme } = useAdminTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      className="admin-theme-toggle inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-black/20"
    >
      <span>{isDark ? "Dark" : "Light"}</span>
      <span className="admin-theme-toggle-track relative flex h-5 w-9 items-center rounded-full bg-stone-200">
        <span
          className={`admin-theme-toggle-knob h-4 w-4 rounded-full bg-[#2f3e36] transition ${
            isDark ? "translate-x-4" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
