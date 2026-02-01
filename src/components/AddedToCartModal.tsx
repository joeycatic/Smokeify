"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";

type AddedItem = {
  title: string;
  imageUrl?: string;
  imageAlt?: string;
  price?: { amount: string; currencyCode: string };
  quantity: number;
  productHandle?: string;
};

type RecommendedItem = {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: { amount: string; currencyCode: string } | null;
};

type Props = {
  open: boolean;
  item: AddedItem | null;
  onClose: () => void;
};

export default function AddedToCartModal({ open, item, onClose }: Props) {
  const [recommendations, setRecommendations] = useState<RecommendedItem[]>([]);
  const [recommendationsStatus, setRecommendationsStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [recIndex, setRecIndex] = useState(0);

  useEffect(() => {
    if (!open || !item?.productHandle) return;
    let active = true;
    setRecommendationsStatus("loading");
    setRecIndex(0);
    fetch(`/api/recommendations?handle=${encodeURIComponent(item.productHandle)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { results?: RecommendedItem[] }) => {
        if (!active) return;
        setRecommendations(data.results ?? []);
        setRecommendationsStatus("idle");
      })
      .catch(() => {
        if (!active) return;
        setRecommendations([]);
        setRecommendationsStatus("error");
      });
    return () => {
      active = false;
    };
  }, [open, item?.productHandle]);

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-green-700">
              Artikel in den Warenkorb gelegt
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-stone-500 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.imageAlt ?? item.title}
              className="h-20 w-20 rounded-md object-cover"
              loading="lazy"
              decoding="async"
              width={80}
              height={80}
            />
          ) : (
            <div className="h-20 w-20 rounded-md bg-stone-100" />
          )}
          <div className="text-sm text-stone-700">
            <div className="font-semibold text-stone-900">{item.title}</div>
            <div>Menge: {item.quantity}</div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-black/5 bg-stone-50 p-4">
          <p className="text-sm font-semibold text-stone-800">
            Empfehlungen für dich
          </p>
          {recommendationsStatus === "loading" && (
            <p className="mt-2 text-xs text-stone-500">Lade Empfehlungen...</p>
          )}
          {recommendationsStatus === "error" && (
            <p className="mt-2 text-xs text-stone-500">
              Empfehlungen konnten nicht geladen werden.
            </p>
          )}
          {recommendationsStatus === "idle" && recommendations.length > 0 && (
            <div className="mt-3">
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setRecIndex((prev) =>
                      recommendations.length === 0
                        ? 0
                        : (prev - 1 + recommendations.length) %
                          recommendations.length,
                    )
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-stone-600 shadow-sm transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label="Vorherige Empfehlung"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex-1 overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(-${recIndex * 100}%)`,
                  }}
                >
                  {recommendations.map((rec) => (
                    <div key={rec.id} className="w-full shrink-0">
                      <Link
                        href={`/products/${rec.handle}`}
                        onClick={onClose}
                        className="group mx-auto flex max-w-xs flex-col items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                      >
                        <div className="w-full overflow-hidden rounded-xl bg-stone-100">
                          {rec.imageUrl ? (
                            <img
                              src={rec.imageUrl}
                              alt={rec.imageAlt ?? rec.title}
                              className="h-60 w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                              loading="lazy"
                              decoding="async"
                              width={320}
                              height={320}
                            />
                          ) : (
                            <div className="h-60 w-full" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-semibold text-stone-900">
                            {rec.title}
                          </p>
                          {rec.price ? (
                            <p className="mt-1 text-sm font-semibold text-emerald-800">
                              {rec.price.amount} {rec.price.currencyCode}
                            </p>
                          ) : null}
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setRecIndex((prev) =>
                      recommendations.length === 0
                        ? 0
                        : (prev + 1) % recommendations.length,
                    )
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white text-stone-600 shadow-sm transition hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  aria-label="Nächste Empfehlung"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-center gap-1">
                {recommendations.map((_, dotIndex) => (
                  <span
                    key={`rec-dot-${dotIndex}`}
                    className={`h-1.5 w-1.5 rounded-full transition ${
                      dotIndex === recIndex
                        ? "bg-emerald-700"
                        : "bg-emerald-200"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}
          {recommendationsStatus === "idle" && recommendations.length === 0 && (
            <p className="mt-2 text-xs text-stone-500">
              Keine Empfehlungen verfügbar.
            </p>
          )}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-stone-700 shadow-sm transition hover:-translate-y-0.5 hover:border-black/20 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Weiter shoppen
          </button>
          <Link
            href="/cart"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#14532d] via-[#2f3e36] to-[#0f766e] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-emerald-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Warenkorb anzeigen
          </Link>
        </div>
      </div>
    </div>
  );
}
