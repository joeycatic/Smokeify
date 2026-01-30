"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { heroSlides } from "@/data/heroSlides";

export function HeroBanner() {
  const slides = heroSlides;
  const [index, setIndex] = useState(0);
  const slide = slides[index] ?? slides[0];
  const slideCount = slides.length;
  const durationMs = 15000;

  useEffect(() => {
    if (slideCount <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slideCount);
    }, durationMs);
    return () => clearInterval(timer);
  }, [slideCount, durationMs]);

  return (
    <section className="relative h-[55vh] w-full overflow-hidden sm:h-[70vh]">
      {/* Background Image */}
      <div key={slide.image} className="absolute inset-0 hero-swipe">
        <Image
          src={slide.image}
          alt={slide.title}
          fill
          priority
          sizes="100vw"
          quality={75}
          className="absolute inset-0 object-cover"
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-28 bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.35)] to-white sm:h-36 md:h-48" />

      {/* Content */}
      <div className="relative z-10 flex h-full items-center px-6 sm:px-10">
        <div className="max-w-xl text-white">
          <h1 className="text-3xl font-bold mb-4 sm:text-4xl md:text-6xl">
            {slide.title}
          </h1>
          <p className="text-base mb-8 sm:text-lg md:text-xl">
            {slide.subtitle}
          </p>

          <Link
            href="/customizer"
            className="inline-flex border border-white px-6 py-3 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 sm:px-8 sm:text-sm"
          >
            {slide.cta}
          </Link>
        </div>
      </div>

      {slideCount > 1 && (
        <div className="absolute right-6 top-6 z-10 w-48">
          <div className="h-1 w-full rounded-full bg-white/25 overflow-hidden">
            <div
              key={`progress-${index}`}
              className="h-full rounded-full bg-white/80 hero-progress"
              style={{ animationDuration: `${durationMs}ms` }}
            />
          </div>
        </div>
      )}

      {/* Controls removed for static hero */}
    </section>
  );
}
