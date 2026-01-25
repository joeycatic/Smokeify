"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type ImageItem = {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
};

type Props = {
  images: ImageItem[];
  alt: string;
};

export default function ProductImageCarousel({ images, alt }: Props) {
  const [index, setIndex] = useState(0);
  const [swerveDirection, setSwerveDirection] = useState<
    "left" | "right" | null
  >(null);
  const [swerveKey, setSwerveKey] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const thumbnailsRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = images.length;
  const current = images[index];

  if (!current) return null;

  const handlePrev = () => {
    if (count <= 1) return;
    setSwerveDirection("left");
    setSwerveKey((prev) => prev + 1);
    setIndex((prev) => (prev - 1 + count) % count);
  };

  const handleNext = () => {
    if (count <= 1) return;
    setSwerveDirection("right");
    setSwerveKey((prev) => prev + 1);
    setIndex((prev) => (prev + 1) % count);
  };

  useEffect(() => {
    const container = thumbnailsRef.current;
    const target = thumbnailRefs.current[index];
    if (!container || !target) return;

    const containerWidth = container.clientWidth;
    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const nextScrollLeft = targetCenter - containerWidth / 2;
    const maxScrollLeft = container.scrollWidth - containerWidth;
    const clampedScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, nextScrollLeft),
    );

    container.scrollTo({ left: clampedScrollLeft, behavior: "smooth" });
  }, [index]);

  useEffect(() => {
    setIsZoomed(false);
    setZoomOrigin({ x: 50, y: 50 });
  }, [index]);

  return (
    <div className="space-y-2">
      <div
        className={`group relative p-3 ${
          isZoomed ? "cursor-zoom-out" : "cursor-zoom-in"
        }`}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 100;
          const y = ((event.clientY - rect.top) / rect.height) * 100;
          setZoomOrigin({
            x: Math.max(0, Math.min(100, x)),
            y: Math.max(0, Math.min(100, y)),
          });
          setIsZoomed((prev) => !prev);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setZoomOrigin({ x: 50, y: 50 });
            setIsZoomed((prev) => !prev);
          }
        }}
        aria-pressed={isZoomed}
      >
        <div
          key={swerveKey}
          className="relative aspect-square overflow-hidden"
          style={
            swerveDirection
              ? {
                  animation: `image-swerve-${swerveDirection} 420ms ease`,
                }
              : undefined
          }
        >
          <Image
            src={current.url}
            alt={current.altText ?? alt}
            fill
            className={`rounded-xl object-cover transition-transform duration-300 ${
              isZoomed ? "scale-200" : "scale-100 group-hover:scale-110"
            }`}
            style={{
              transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
            }}
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority={index === 0}
          />
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Vorheriges Bild"
              onClick={handlePrev}
              className="absolute left-10 top-1/2 -translate-y-1/2 rounded-full bg-black/85 p-2 text-white shadow-lg shadow-black/30 opacity-0 transition hover:bg-black/90 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Naechstes Bild"
              onClick={handleNext}
              className="absolute right-10 top-1/2 -translate-y-1/2 rounded-full bg-black/85 p-2 text-white shadow-lg shadow-black/30 opacity-0 transition hover:bg-black/90 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div
          ref={thumbnailsRef}
          className="flex gap-3 overflow-x-auto px-3 pb-1 scroll-px-3 scroll-smooth snap-x snap-mandatory"
        >
          {images.map((img, imgIndex) => {
            const active = imgIndex === index;
            return (
              <button
                key={img.url}
                type="button"
                onClick={() => setIndex(imgIndex)}
                ref={(el) => {
                  thumbnailRefs.current[imgIndex] = el;
                }}
                className={`shrink-0 snap-start overflow-hidden rounded-xl border bg-white p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                  active
                    ? "border-black ring-2 ring-black/20"
                    : "border-black/10 hover:border-black/25"
                }`}
                aria-label={`Bild ${imgIndex + 1} auswaehlen`}
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? alt}
                  width={100}
                  height={100}
                  className="h-28 w-28 rounded-lg object-cover"
                  loading="lazy"
                  sizes="128px"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
