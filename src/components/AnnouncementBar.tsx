"use client";

import { useEffect, useState } from "react";
import { TruckIcon } from "@heroicons/react/24/outline";

const ANNOUNCEMENT_BAR_HEIGHT = 40;

export function AnnouncementBar() {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let frameId: number | null = null;

    const syncHiddenState = () => {
      frameId = null;
      setIsHidden(window.scrollY > 12);
    };

    const onScroll = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(syncHiddenState);
    };

    syncHiddenState();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--smk-announcement-offset",
      isHidden ? "0px" : `${ANNOUNCEMENT_BAR_HEIGHT}px`,
    );

    return () => {
      root.style.setProperty("--smk-announcement-offset", "0px");
    };
  }, [isHidden]);

  return (
    <div
      className={`announcement-bar fixed left-0 top-0 z-50 w-full border-b border-[var(--smk-border)] bg-[linear-gradient(90deg,rgba(20,20,18,0.97),rgba(34,28,24,0.97),rgba(16,16,14,0.97))] text-[11px] text-[var(--smk-text-muted)] shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-[transform,opacity] duration-300 ${
        isHidden
          ? "pointer-events-none -translate-y-full opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      <div className="mx-auto flex h-10 max-w-[1280px] items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[var(--smk-accent)]">
          <TruckIcon className="h-4 w-4" />
          <span className="tracking-[0.16em] uppercase">
            Kostenloser Versand ab 69 EUR
          </span>
        </div>
      </div>
    </div>
  );
}
