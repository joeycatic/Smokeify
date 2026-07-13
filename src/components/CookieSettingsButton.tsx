"use client";

import type { ReactNode } from "react";
import { COOKIE_CONSENT_SETTINGS_REQUESTED_EVENT } from "@/lib/analyticsShared";

export default function CookieSettingsButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new Event(COOKIE_CONSENT_SETTINGS_REQUESTED_EVENT),
        );
      }}
      className={className}
    >
      {children}
    </button>
  );
}
