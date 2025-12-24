"use client";

import { useMemo, useState } from "react";
import PageLayout from "@/components/PageLayout";

type Option = {
  id: string;
  label: string;
  price: number;
  note?: string;
};

const SIZE_OPTIONS: Option[] = [
  { id: "s", label: "60x60 cm (Starter)", price: 149 },
  { id: "m", label: "80x80 cm (Balanced)", price: 219 },
  { id: "l", label: "100x100 cm (Pro)", price: 299 },
];

const LIGHT_OPTIONS: Option[] = [
  { id: "led-200", label: "LED 200W", price: 169 },
  { id: "led-300", label: "LED 300W", price: 249 },
  { id: "led-400", label: "LED 400W", price: 329 },
];

const VENT_OPTIONS: Option[] = [
  { id: "vent-basic", label: "Basic Exhaust + Filter", price: 129 },
  { id: "vent-silent", label: "Silent Exhaust + Filter", price: 189 },
];

const EXTRA_OPTIONS: Option[] = [
  { id: "timer", label: "Timer", price: 19 },
  { id: "hygro", label: "Hygrometer", price: 29 },
  { id: "fan", label: "Clip Fan", price: 35 },
  { id: "tray", label: "Watering Tray", price: 22 },
];

function formatPrice(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function CustomizerPage() {
  const [sizeId, setSizeId] = useState("m");
  const [lightId, setLightId] = useState("led-300");
  const [ventId, setVentId] = useState("vent-basic");
  const [extras, setExtras] = useState<string[]>([]);

  const selectedSize = SIZE_OPTIONS.find((o) => o.id === sizeId);
  const selectedLight = LIGHT_OPTIONS.find((o) => o.id === lightId);
  const selectedVent = VENT_OPTIONS.find((o) => o.id === ventId);

  const extrasTotal = useMemo(() => {
    return extras
      .map((id) => EXTRA_OPTIONS.find((o) => o.id === id)?.price ?? 0)
      .reduce((a, b) => a + b, 0);
  }, [extras]);

  const total = (selectedSize?.price ?? 0) +
    (selectedLight?.price ?? 0) +
    (selectedVent?.price ?? 0) +
    extrasTotal;

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-10 text-stone-800">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-3" style={{ color: "#2f3e36" }}>
            Grow Setup Customizer
          </h1>
          <p className="text-stone-600">
            Stelle dein Setup zusammen. Produkte werden spaeter mit echten Artikeln verknuepft.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                1. ZELT-GROESSE
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSizeId(opt.id)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      sizeId === opt.id
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white hover:border-black/20"
                    }`}
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs opacity-80">{formatPrice(opt.price)}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                2. LICHT
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {LIGHT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLightId(opt.id)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      lightId === opt.id
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white hover:border-black/20"
                    }`}
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs opacity-80">{formatPrice(opt.price)}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                3. ABLUFT
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {VENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVentId(opt.id)}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      ventId === opt.id
                        ? "border-black bg-black text-white"
                        : "border-black/10 bg-white hover:border-black/20"
                    }`}
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs opacity-80">{formatPrice(opt.price)}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                4. EXTRAS
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {EXTRA_OPTIONS.map((opt) => {
                  const active = extras.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setExtras((prev) =>
                          prev.includes(opt.id)
                            ? prev.filter((id) => id !== opt.id)
                            : [...prev, opt.id]
                        )
                      }
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        active
                          ? "border-green-700 bg-green-50 text-green-800"
                          : "border-black/10 bg-white hover:border-black/20"
                      }`}
                    >
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-xs opacity-80">{formatPrice(opt.price)}</div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="rounded-xl border border-black/10 bg-white p-6 h-fit">
            <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
              DEIN SETUP
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Zelt</span>
                <span>{selectedSize?.label ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Licht</span>
                <span>{selectedLight?.label ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Abluft</span>
                <span>{selectedVent?.label ?? "-"}</span>
              </div>
              <div className="flex justify-between">
                <span>Extras</span>
                <span>{extras.length ? `${extras.length} gewaehrt` : "-"}</span>
              </div>
            </div>

            <div className="mt-5 border-t border-black/10 pt-4">
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Gesamt</span>
                <span>{formatPrice(total)}</span>
              </div>
              <p className="mt-2 text-xs text-stone-500">
                Preis ist eine Schaetzung. Produkte werden spaeter verknuepft.
              </p>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                className="w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white"
              >
                Setup speichern
              </button>
              <button
                type="button"
                className="w-full rounded-md border border-black/15 px-4 py-3 text-sm font-semibold text-black/70"
              >
                Angebot anfragen
              </button>
            </div>
          </aside>
        </div>
      </div>
    </PageLayout>
  );
}
