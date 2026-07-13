"use client";

import { useEffect, useRef, useState } from "react";
import { useDocumentLanguage } from "@/hooks/useDocumentLanguage";
import {
  ArrowPathIcon,
  CheckBadgeIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";
import type { Language } from "@/lib/language";
import { ANNOUNCEMENT_ITEMS } from "@/lib/storefrontTrust";

const ITEMS: Record<
  Language,
  Array<{ icon: typeof TruckIcon; text: string }>
> = {
  de: [
    {
      icon: TruckIcon,
      text: ANNOUNCEMENT_ITEMS.de[0],
    },
    {
      icon: ArrowPathIcon,
      text: ANNOUNCEMENT_ITEMS.de[1],
    },
    {
      icon: CheckBadgeIcon,
      text: ANNOUNCEMENT_ITEMS.de[2],
    },
  ],
  en: [
    {
      icon: TruckIcon,
      text: ANNOUNCEMENT_ITEMS.en[0],
    },
    {
      icon: ArrowPathIcon,
      text: ANNOUNCEMENT_ITEMS.en[1],
    },
    {
      icon: CheckBadgeIcon,
      text: ANNOUNCEMENT_ITEMS.en[2],
    },
  ],
};

const ANNOUNCEMENT_OFFSET_HIDDEN = "0px";
const TOP_REVEAL_SCROLL_Y = 8;
const DIRECTION_DELTA_THRESHOLD = 4;
const MOBILE_HIDE_AFTER_SCROLL_Y = 12;
const DESKTOP_HIDE_AFTER_SCROLL_Y = 24;
const MOBILE_UPWARD_REVEAL_DISTANCE = 56;
const DESKTOP_UPWARD_REVEAL_DISTANCE = 96;

export function AnnouncementBar({ language: initialLanguage }: { language?: Language }) {
  const language = useDocumentLanguage(initialLanguage);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const barRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const lastVisibilityChangeScrollYRef = useRef(0);
  const isVisibleRef = useRef(true);
  const upwardScrollDistanceRef = useRef(0);
  const items = ITEMS[language];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollYRef.current;
      const isMobile = window.matchMedia("(max-width: 639px)").matches;
      const hideAfterScrollY = isMobile
        ? MOBILE_HIDE_AFTER_SCROLL_Y
        : DESKTOP_HIDE_AFTER_SCROLL_Y;
      const upwardRevealDistance = isMobile
        ? MOBILE_UPWARD_REVEAL_DISTANCE
        : DESKTOP_UPWARD_REVEAL_DISTANCE;
      let nextVisible = isVisibleRef.current;

      if (delta < -DIRECTION_DELTA_THRESHOLD) {
        upwardScrollDistanceRef.current += Math.abs(delta);
      } else if (delta > DIRECTION_DELTA_THRESHOLD) {
        upwardScrollDistanceRef.current = 0;
      }

      if (currentScrollY <= TOP_REVEAL_SCROLL_Y) {
        nextVisible = true;
      } else if (
        isVisibleRef.current &&
        currentScrollY >= hideAfterScrollY &&
        currentScrollY - lastVisibilityChangeScrollYRef.current >=
          hideAfterScrollY &&
        delta > DIRECTION_DELTA_THRESHOLD
      ) {
        nextVisible = false;
      } else if (
        !isVisibleRef.current &&
        upwardScrollDistanceRef.current >= upwardRevealDistance
      ) {
        nextVisible = true;
      }

      if (nextVisible !== isVisibleRef.current) {
        isVisibleRef.current = nextVisible;
        lastVisibilityChangeScrollYRef.current = currentScrollY;
        setIsVisible(nextVisible);
        upwardScrollDistanceRef.current = 0;
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const updateOffset = () => {
      const nextOffset = isVisible
        ? `${barRef.current?.getBoundingClientRect().height ?? 0}px`
        : ANNOUNCEMENT_OFFSET_HIDDEN;

      if (
        document.documentElement.style.getPropertyValue("--gv-announcement-offset") !==
        nextOffset
      ) {
        document.documentElement.style.setProperty(
          "--gv-announcement-offset",
          nextOffset,
        );
      }
    };

    updateOffset();
    const resizeObserver =
      typeof ResizeObserver === "undefined" || !barRef.current
        ? null
        : new ResizeObserver(updateOffset);
    if (barRef.current) resizeObserver?.observe(barRef.current);
    window.addEventListener("resize", updateOffset);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, [isVisible]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--gv-announcement-offset");
    };
  }, []);

  const item = items[activeIndex];
  const Icon = item.icon;

  return (
    <div
      ref={barRef}
      className={`gv-announcement-bar w-full border-b border-[color:var(--gv-border)] bg-[color:var(--gv-lime-dim)] text-white shadow-[var(--gv-shadow)] transition-transform duration-150 ease-out will-change-transform ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: "var(--gv-z-announcement)",
      }}
    >
      <div className="mx-auto flex h-7 max-w-[1280px] items-center justify-center px-3 text-center sm:h-10 sm:px-4">
        <div
          key={item.text}
          className="gv-fadeup flex min-w-0 items-center gap-1.5 text-[11px] font-semibold sm:gap-2 sm:text-[13px]"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
          <span className="truncate">{item.text}</span>
        </div>
      </div>
    </div>
  );
}
