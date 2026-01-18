"use client";

import { useEffect, useState } from "react";
import { heroSlides } from "@/data/heroSlides";

export function HeroBanner() {
  const [index, setIndex] = useState(0);

  // Auto-Slide
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % heroSlides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const slide = heroSlides[index];

  return (
    <section className="relative h-[70vh] w-full overflow-hidden mb-10 mt-5">
      {/* Background Image */}
      <img
        key={slide.image}
        src={slide.image}
        alt={slide.title}
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
        loading={index === 0 ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={index === 0 ? "high" : "auto"}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex h-full items-center px-10">
        <div className="max-w-xl text-white">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            {slide.title}
          </h1>
          <p className="text-lg md:text-xl mb-8">
            {slide.subtitle}
          </p>

          <button className="border border-white px-8 py-3 uppercase tracking-widest hover:bg-white hover:text-black transition">
            {slide.cta}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute right-6 bottom-6 flex gap-2 z-20">
        {heroSlides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`h-2 w-8 rounded-full transition ${
              i === index ? "bg-white" : "bg-white/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
