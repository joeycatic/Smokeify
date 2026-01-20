import Image from "next/image";
import { heroSlides } from "@/data/heroSlides";

export function HeroBanner() {
  const slide = heroSlides[0];

  return (
    <section className="relative h-[55vh] w-full overflow-hidden mb-10 mt-5 sm:h-[70vh]">
      {/* Background Image */}
      <Image
        src={slide.image}
        alt={slide.title}
        fill
        priority
        sizes="100vw"
        quality={75}
        className="absolute inset-0 object-cover"
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex h-full items-center px-6 sm:px-10">
        <div className="max-w-xl text-white">
          <h1 className="text-3xl font-bold mb-4 sm:text-4xl md:text-6xl">
            {slide.title}
          </h1>
          <p className="text-base mb-8 sm:text-lg md:text-xl">
            {slide.subtitle}
          </p>

          <button
            type="button"
            className="border border-white px-6 py-3 text-xs uppercase tracking-widest hover:bg-white hover:text-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 sm:px-8 sm:text-sm"
          >
            {slide.cta}
          </button>
        </div>
      </div>

      {/* Controls removed for static hero */}
    </section>
  );
}
