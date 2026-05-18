"use client";

import { useEffect, useState } from "react";
import {
  CheckBadgeIcon,
  TruckIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

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

  const items = [
    { icon: <ArrowPathIcon className="h-4 w-4" />, text: "14 Tage Rückgabe" },
    {
      icon: <CheckBadgeIcon className="h-4 w-4" />,
      text: "Sichere Zahlung mit Stripe",
    },
    {
      icon: <TruckIcon className="h-4 w-4" />,
      text: "Kostenloser Versand ab 69 EUR",
    },
    {
      icon: <CheckBadgeIcon className="h-4 w-4" />,
      text: "15 EUR Mindestbestellwert",
    },
  ];
  const loopItems = [...items, ...items];

  return (
    <div
      className={`announcement-bar fixed left-0 top-0 z-50 w-full border-b border-[var(--smk-border)] bg-[linear-gradient(90deg,rgba(20,20,18,0.97),rgba(34,28,24,0.97),rgba(16,16,14,0.97))] text-[11px] text-[var(--smk-text-muted)] shadow-[0_14px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-[transform,opacity] duration-300 ${
        isHidden
          ? "pointer-events-none -translate-y-full opacity-0"
          : "translate-y-0 opacity-100"
      }`}
    >
      <div className="mx-auto w-full px-0">
        <div className="relative flex h-10 items-center overflow-hidden">
          <div className="announcement-marquee flex items-center">
            <div className="flex flex-none items-center gap-[120px]">
              {loopItems.map((item, idx) => (
                <Item key={`a-${idx}`} icon={item.icon}>
                  {item.text}
                </Item>
              ))}
            </div>
            <div className="flex flex-none w-[120px]" aria-hidden="true" />
            <div
              className="flex flex-none items-center gap-[120px]"
              aria-hidden="true"
            >
              {loopItems.map((item, idx) => (
                <Item key={`b-${idx}`} icon={item.icon}>
                  {item.text}
                </Item>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-10 items-center gap-2 whitespace-nowrap">
      <span className="text-[var(--smk-accent)]">{icon}</span>
      <span className="tracking-[0.22em] uppercase">{children}</span>
    </div>
  );
}
