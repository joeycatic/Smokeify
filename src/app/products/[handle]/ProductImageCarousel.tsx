"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getImageFallbackLabel,
  shouldBypassImageOptimization,
} from "@/lib/storefrontImages";

type ImageItem = {
  url: string;
  altText?: string | null;
  width?: number | null;
  height?: number | null;
  position?: number | null;
};

type Props = {
  images: ImageItem[];
  alt: string;
};

export default function ProductImageCarousel({ images, alt }: Props) {
  const [index, setIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<
    "left" | "right" | null
  >(null);
  const [slideKey, setSlideKey] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const thumbnailsRef = useRef<HTMLDivElement | null>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = images.length;
  const current = images[index] ?? null;

  const handlePrev = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    if (count <= 1) return;
    setIsZoomed(false);
    setZoomOrigin({ x: 50, y: 50 });
    setSlideDirection("left");
    setSlideKey((prev) => prev + 1);
    setIndex((prev) => (prev - 1 + count) % count);
  };

  const handleNext = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    if (count <= 1) return;
    setIsZoomed(false);
    setZoomOrigin({ x: 50, y: 50 });
    setSlideDirection("right");
    setSlideKey((prev) => prev + 1);
    setIndex((prev) => (prev + 1) % count);
  };

  useEffect(() => {
    if (!current) return;
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
  }, [current, index]);

  useEffect(() => {
    if (images.length === 0) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ position?: number | null }>).detail;
      const position = detail?.position;
      if (typeof position !== "number") return;
      const nextIndex = images.findIndex(
        (image) => image.position === position,
      );
      if (nextIndex < 0) return;
      setIsZoomed(false);
      setZoomOrigin({ x: 50, y: 50 });
      setIndex(nextIndex);
    };
    window.addEventListener("product-image-position", handler);
    return () => window.removeEventListener("product-image-position", handler);
  }, [images]);

  if (!current) return null;
  const currentAlt = current.altText ?? alt;
  const currentFailed = failedImages.has(current.url);
  const markImageFailed = (url: string) => {
    setFailedImages((previous) => {
      if (previous.has(url)) return previous;
      const next = new Set(previous);
      next.add(url);
      return next;
    });
  };

  return (
    <div className="space-y-2 sm:space-y-1">
      <div
        className={`group relative p-0 sm:p-3 ${
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
          key={slideKey}
          className="relative aspect-square overflow-hidden bg-white sm:rounded-2xl"
          style={
            slideDirection
              ? {
                  animation: `image-slide-${slideDirection} 420ms ease`,
                }
              : undefined
          }
        >
          {currentFailed ? (
            <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#f7faf2_0%,#eef4e9_52%,#dfead8_100%)] sm:rounded-2xl">
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,14,11,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(12,14,11,0.035)_1px,transparent_1px)] bg-[size:34px_34px]" />
              <div className="relative grid h-24 w-24 place-items-center rounded-3xl border border-[#182414]/10 bg-white/80 font-[family:var(--font-jetbrains-mono)] text-xl font-bold text-[#2A3828] shadow-sm">
                {getImageFallbackLabel(currentAlt)}
              </div>
              <p className="sr-only">Produktbild konnte nicht geladen werden.</p>
            </div>
          ) : (
            <Image
              src={current.url}
              alt={currentAlt}
              fill
              className={`object-contain transition-transform duration-300 sm:rounded-2xl ${
                isZoomed ? "scale-200" : "scale-100"
              }`}
              style={{
                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
              }}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority={index === 0}
              quality={70}
              unoptimized={shouldBypassImageOptimization(current.url)}
              onError={() => markImageFailed(current.url)}
            />
          )}
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Vorheriges Bild"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-black/85 text-white shadow-lg shadow-black/30 transition hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:left-7 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Nächstes Bild"
              onClick={handleNext}
              className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-black/10 bg-black/85 text-white shadow-lg shadow-black/30 transition hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:right-7 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full bg-black/80 px-2.5 py-1 font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold text-white shadow sm:bottom-6 sm:right-6">
              {index + 1}/{count}
            </div>
          </>
        )}
      </div>

      {count > 1 && (
        <>
          <div
            className="flex items-center justify-center gap-1.5 px-4 sm:hidden"
            aria-label="Bildnavigation"
          >
            {images.map((img, imgIndex) => {
              const active = imgIndex === index;
              return (
                <button
                  key={`${img.url}-dot`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsZoomed(false);
                    setZoomOrigin({ x: 50, y: 50 });
                    setIndex(imgIndex);
                  }}
                  className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/50 ${
                    active
                      ? "w-7 bg-[color:var(--gv-lime)]"
                      : "w-2 bg-[color:var(--gv-text-muted)]/45"
                  }`}
                  aria-label={`Bild ${imgIndex + 1} auswählen`}
                />
              );
            })}
          </div>
          <div
            ref={thumbnailsRef}
            className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-3 pt-1 scroll-px-3 scroll-smooth snap-x snap-mandatory sm:gap-3 sm:pb-1"
          >
            {images.map((img, imgIndex) => {
              const active = imgIndex === index;
              return (
                <button
                  key={img.url}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsZoomed(false);
                    setZoomOrigin({ x: 50, y: 50 });
                    setIndex(imgIndex);
                  }}
                  ref={(el) => {
                    thumbnailRefs.current[imgIndex] = el;
                  }}
                  className={`relative shrink-0 snap-start overflow-hidden rounded-xl border bg-white p-1 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-dark)] sm:p-2 ${
                    active
                      ? "scale-[1.02] border-[color:var(--gv-lime)] ring-4 ring-[color:var(--gv-lime)]/35 shadow-[0_0_0_1px_rgba(31,95,63,0.55),0_12px_26px_var(--gv-lime-glow)]"
                      : "border-black/10 opacity-80 hover:border-[color:var(--gv-lime)]/70 hover:opacity-100"
                  }`}
                  aria-label={`Bild ${imgIndex + 1} auswählen`}
                  aria-current={active ? "true" : undefined}
                >
                  {active ? (
                    <span className="absolute right-1.5 top-1.5 z-10 h-2.5 w-2.5 rounded-full bg-[color:var(--gv-lime)] shadow-[0_0_0_3px_rgba(255,255,255,0.9)]" />
                  ) : null}
                  <Image
                    src={img.url}
                    alt={img.altText ?? alt}
                    width={100}
                    height={100}
                    className="h-16 w-16 rounded-lg bg-white object-contain sm:h-28 sm:w-28"
                    loading="lazy"
                    sizes="(min-width: 640px) 128px, 72px"
                    unoptimized={shouldBypassImageOptimization(img.url)}
                    onError={() => markImageFailed(img.url)}
                  />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
