"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { heroSlides } from "@/data/heroSlides";

const slide = heroSlides[0];

// Must match remotion/src/HeroBanner.tsx timing constants
const FPS = 30;
const INTRO_S = 45 / FPS;   // 1.5s
const SLIDE_S = 120 / FPS;  // 4s per product
const OUTRO_S = 45 / FPS;   // 1.5s
const TOTAL_S = INTRO_S + 5 * SLIDE_S + OUTRO_S; // 23s

const SLIDES = [
  { href: "/products/lux-helios-pro-300-watt-2-8" },
  { href: "/products/diamondbox-sl-60" },
  { href: "/products/ac-infinity-cloudray-s6" },
  { href: "/products/norddampf-dab-peb" },
  { href: "/products/secret-jardin-hydro-shoot-60-grow-set-60-60-158-cm" },
];

function getCurrentHref(t: number): string {
  const looped = t % TOTAL_S;
  if (looped < INTRO_S || looped >= TOTAL_S - OUTRO_S) return "/products";
  const idx = Math.floor((looped - INTRO_S) / SLIDE_S);
  return SLIDES[idx]?.href ?? "/products";
}

export function HeroBanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [href, setHref] = useState("/products");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setHref(getCurrentHref(video.currentTime));
    video.addEventListener("timeupdate", update);
    return () => video.removeEventListener("timeupdate", update);
  }, []);

  return (
    <section className="relative h-[55vh] w-full overflow-hidden sm:h-[70vh]">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        loop
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src={slide.videoMp4} type="video/mp4" />
        <source src={slide.videoWebm} type="video/webm" />
      </video>
      <Link href={href} className="absolute inset-0 z-10" aria-label="Produkt ansehen" />
    </section>
  );
}
