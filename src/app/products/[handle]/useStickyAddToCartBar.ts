"use client";

import { useEffect, useState, type RefObject } from "react";
import { trackStickyAddToCartBar } from "./stickyAddToCartTracker";

export function useStickyAddToCartBar(
  targetRef: RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [navBottom, setNavBottom] = useState(96);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) {
      return;
    }

    return trackStickyAddToCartBar({
      target: el,
      onChange: ({ navBottom: nextNavBottom, showStickyBar: nextShow }) => {
        setNavBottom(nextNavBottom);
        setShowStickyBar(nextShow);
      },
    });
  }, [enabled, targetRef]);

  return { showStickyBar: enabled ? showStickyBar : false, navBottom };
}
