"use client";

import Image from "next/image";
import { useState } from "react";
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

  return (
    <div className="space-y-4">
      <div className="group relative p-3">
        <div
          key={swerveKey}
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
            width={900}
            height={900}
            className="h-auto w-full rounded-xl object-cover"
            priority
          />
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Vorheriges Bild"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-stone-700 shadow opacity-0 transition hover:bg-white group-hover:opacity-100"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Naechstes Bild"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-stone-700 shadow opacity-0 transition hover:bg-white group-hover:opacity-100"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="grid grid-cols-4 gap-3">
          {images.slice(0, 8).map((img, imgIndex) => {
            const active = imgIndex === index;
            return (
              <button
                key={img.url}
                type="button"
                onClick={() => setIndex(imgIndex)}
                className={`overflow-hidden rounded-xl border bg-white p-2 transition ${
                  active
                    ? "border-black ring-2 ring-black/20"
                    : "border-black/10 hover:border-black/25"
                }`}
                aria-label="Bild auswaehlen"
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? alt}
                  width={200}
                  height={200}
                  className="h-24 w-full rounded-lg object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
