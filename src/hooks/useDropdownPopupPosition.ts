"use client";

import { useEffect, useState } from "react";

export type DropdownPopupStyle = {
  top: number;
  left: number;
  width: number;
};

export function useDropdownPopupPosition(
  trigger: HTMLElement | null,
  active: boolean,
  maxWidth: number,
): DropdownPopupStyle | null {
  const [style, setStyle] = useState<DropdownPopupStyle | null>(null);

  useEffect(() => {
    if (!active || !trigger) return;
    let rafId: number | null = null;
    const update = () => {
      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 16;
      const width = Math.min(maxWidth, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, viewportPadding),
        window.innerWidth - viewportPadding - width,
      );
      const next = { top: rect.bottom + 10, left, width };
      setStyle((prev) => {
        if (
          prev &&
          prev.top === next.top &&
          prev.left === next.left &&
          prev.width === next.width
        ) {
          return prev;
        }
        return next;
      });
    };
    const scheduleUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };
    update();
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [active, trigger, maxWidth]);

  return style;
}
