"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import PageLayout from "@/components/PageLayout";
import LoadingSpinner from "@/components/LoadingSpinner";

type Option = {
  id: string;
  label: string;
  price: number;
  note?: string;
  size?: string;
  diameterMm?: number;
  diametersMm?: number[];
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
  { id: "vent-basic", label: "Basis-Abluft + Filter", price: 129 },
  { id: "vent-silent", label: "Leise Abluft + Filter", price: 189 },
];

const EXTRA_OPTIONS: Option[] = [
  { id: "timer", label: "Timer", price: 19 },
  { id: "hygro", label: "Hygrometer", price: 29 },
  { id: "fan", label: "Clip-Ventilator", price: 35 },
  { id: "tray", label: "Gießwanne", price: 22 },
];

function formatPrice(amount: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function CustomizerPage() {
  const { data: session, status } = useSession();
  const isAdmin =
    session?.user?.role === "ADMIN" || session?.user?.role === "STAFF";
  const [sizeId, setSizeId] = useState("m");
  const [lightId, setLightId] = useState("led-300");
  const [ventId, setVentId] = useState("vent-basic");
  const [extras, setExtras] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sizeOptions, setSizeOptions] = useState<Option[]>([]);
  const [sizeLoading, setSizeLoading] = useState(false);
  const [sizeError, setSizeError] = useState("");
  const [lightOptions, setLightOptions] = useState<Option[]>([]);
  const [lightLoading, setLightLoading] = useState(false);
  const [lightError, setLightError] = useState("");
  const [ventOptions, setVentOptions] = useState<Option[]>([]);
  const [ventLoading, setVentLoading] = useState(false);
  const [ventError, setVentError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setSizeLoading(true);
    setSizeError("");
    fetch("/api/customizer/options?category=growboxen")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Konnte Produkte nicht laden.");
        }
        return (await res.json()) as { options?: Option[] };
      })
      .then((data) => {
        if (!active) return;
        setSizeOptions(data.options ?? []);
      })
      .catch((err: Error) => {
        if (!active) return;
        setSizeError(err.message || "Konnte Produkte nicht laden.");
      })
      .finally(() => {
        if (!active) return;
        setSizeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setLightLoading(true);
    setLightError("");
    fetch("/api/customizer/options?category=Licht")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Konnte Licht-Produkte nicht laden.");
        }
        return (await res.json()) as { options?: Option[] };
      })
      .then((data) => {
        if (!active) return;
        setLightOptions(data.options ?? []);
      })
      .catch((err: Error) => {
        if (!active) return;
        setLightError(err.message || "Konnte Licht-Produkte nicht laden.");
      })
      .finally(() => {
        if (!active) return;
        setLightLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setVentLoading(true);
    setVentError("");
    fetch("/api/customizer/options?category=Luft")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Konnte Luft-Produkte nicht laden.");
        }
        return (await res.json()) as { options?: Option[] };
      })
      .then((data) => {
        if (!active) return;
        setVentOptions(data.options ?? []);
      })
      .catch((err: Error) => {
        if (!active) return;
        setVentError(err.message || "Konnte Luft-Produkte nicht laden.");
      })
      .finally(() => {
        if (!active) return;
        setVentLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!sizeOptions.length) return;
    setSizeId((prev) =>
      sizeOptions.some((opt) => opt.id === prev) ? prev : sizeOptions[0].id,
    );
  }, [sizeOptions]);

  useEffect(() => {
    if (!lightOptions.length) return;
    setLightId((prev) =>
      lightOptions.some((opt) => opt.id === prev) ? prev : lightOptions[0].id,
    );
  }, [lightOptions]);

  useEffect(() => {
    if (!ventOptions.length) return;
    setVentId((prev) =>
      ventOptions.some((opt) => opt.id === prev) ? prev : ventOptions[0].id,
    );
  }, [ventOptions]);

  const selectedSize = (isAdmin ? sizeOptions : SIZE_OPTIONS).find(
    (o) => o.id === sizeId,
  );
  const selectedLight = (isAdmin ? lightOptions : LIGHT_OPTIONS).find(
    (o) => o.id === lightId,
  );
  const selectedVent = (isAdmin ? ventOptions : VENT_OPTIONS).find(
    (o) => o.id === ventId,
  );

  const parseSize = (value?: string) => {
    if (!value) return null;
    const matches = value.match(/(\d+(?:[.,]\d+)?)/g);
    if (!matches || matches.length < 2) return null;
    const numbers = matches
      .map((match) => Number(match.replace(",", ".")))
      .filter((num) => Number.isFinite(num));
    if (numbers.length < 2) return null;
    return { width: numbers[0], depth: numbers[1], height: numbers[2] ?? null };
  };

  const tentSize = parseSize(selectedSize?.size ?? selectedSize?.label);
  const lightSize = parseSize(selectedLight?.size ?? selectedLight?.label);
  const lightCompatible =
    !tentSize ||
    !lightSize ||
    (lightSize.width <= tentSize.width && lightSize.depth <= tentSize.depth);
  const tentDiameters = selectedSize?.diametersMm ?? [];
  const airDiameter = selectedVent?.diameterMm ?? null;
  const airCompatible =
    tentDiameters.length === 0 ||
    !airDiameter ||
    tentDiameters.includes(airDiameter);

  const extrasTotal = useMemo(() => {
    return extras
      .map((id) => EXTRA_OPTIONS.find((o) => o.id === id)?.price ?? 0)
      .reduce((a, b) => a + b, 0);
  }, [extras]);

  const total =
    (selectedSize?.price ?? 0) +
    (selectedLight?.price ?? 0) +
    (selectedVent?.price ?? 0) +
    extrasTotal;

  if (status === "loading") {
    return (
      <PageLayout>
        <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center px-6 py-12 text-center text-stone-700">
          <div className="flex items-center gap-3">
            <LoadingSpinner size="md" />
            <span>Customizer wird geladen...</span>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    const previewSize = SIZE_OPTIONS[1];
    const previewLight = LIGHT_OPTIONS[1];
    const previewVent = VENT_OPTIONS[0];
    const previewExtras = [EXTRA_OPTIONS[0], EXTRA_OPTIONS[2]];
    const previewTotal =
      (previewSize?.price ?? 0) +
      (previewLight?.price ?? 0) +
      (previewVent?.price ?? 0) +
      previewExtras.reduce((sum, opt) => sum + opt.price, 0);

    return (
      <PageLayout>
        <div className="mx-auto max-w-6xl px-6 py-12 text-stone-800">
          <div className="rounded-2xl border border-[#E4C56C]/70 bg-white p-8 shadow-[0_20px_50px_rgba(58,75,65,0.18)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="text-xs font-semibold tracking-widest text-[#2f3e36]">
                  CUSTOMIZER
                </p>
                <h1
                  className="mt-2 text-4xl font-bold"
                  style={{ color: "#2f3e36" }}
                >
                  Demnächst verfügbar
                </h1>
                <p className="mt-3 text-sm text-stone-600">
                  Unser interaktiver Setup-Builder ist bald live. Bis dahin
                  kannst du hier einen Ausblick auf die Konfiguration sehen.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#E4C56C] bg-[#E4C56C]/40 px-3 py-1 text-xs font-semibold text-[#2f3e36]">
                  Vorschau aktiv
                </div>
              </div>
              <div className="rounded-xl border border-[#E4C56C]/60 bg-[#f9f4dd] p-5">
                <p className="text-xs font-semibold tracking-widest text-[#2f3e36]">
                  WAS KOMMT
                </p>
                <ul className="mt-3 space-y-2 text-sm text-stone-600">
                  <li>Live-Preis-Updates</li>
                  <li>Setup speichern & teilen</li>
                  <li>Empfehlungen pro Raumgröße</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-[#E4C56C]/60 bg-white p-6 shadow-[0_18px_40px_rgba(58,75,65,0.16)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold tracking-widest text-[#2f3e36]">
                PREVIEW
              </p>
              <span className="text-xs font-semibold text-stone-500">
                Nicht interaktiv
              </span>
            </div>

            <div className="pointer-events-none select-none">
              <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-6">
                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      1. ZELT-GRÖSSE
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {SIZE_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded-lg border px-4 py-3 text-left ${
                            previewSize?.id === opt.id
                              ? "border-[#E4C56C] bg-[#E4C56C] text-[#2f3e36]"
                              : "border-black/10 bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            {opt.label}
                          </div>
                          <div className="text-xs opacity-80">
                            {formatPrice(opt.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      2. LICHT
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {LIGHT_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded-lg border px-4 py-3 text-left ${
                            previewLight?.id === opt.id
                              ? "border-[#E4C56C] bg-[#E4C56C] text-[#2f3e36]"
                              : "border-black/10 bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            {opt.label}
                          </div>
                          <div className="text-xs opacity-80">
                            {formatPrice(opt.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      3. ABLUFT
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {VENT_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          className={`rounded-lg border px-4 py-3 text-left ${
                            previewVent?.id === opt.id
                              ? "border-[#E4C56C] bg-[#E4C56C] text-[#2f3e36]"
                              : "border-black/10 bg-white"
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            {opt.label}
                          </div>
                          <div className="text-xs opacity-80">
                            {formatPrice(opt.price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-xl border border-black/10 bg-white p-5">
                    <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                      4. EXTRAS
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {EXTRA_OPTIONS.map((opt) => {
                        const active = previewExtras.some(
                          (extra) => extra.id === opt.id
                        );
                        return (
                          <div
                            key={opt.id}
                            className={`rounded-lg border px-4 py-3 text-left ${
                              active
                                ? "border-[#3a4b41] bg-[#E4C56C]/30 text-[#2f3e36]"
                                : "border-black/10 bg-white"
                            }`}
                          >
                            <div className="text-sm font-semibold">
                              {opt.label}
                            </div>
                            <div className="text-xs opacity-80">
                              {formatPrice(opt.price)}
                            </div>
                          </div>
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
                      <span>{previewSize?.label ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Licht</span>
                      <span>{previewLight?.label ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Abluft</span>
                      <span>{previewVent?.label ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Extras</span>
                      <span>{previewExtras.length} gewählt</span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-black/10 pt-4">
                    <div className="flex items-center justify-between text-base font-semibold">
                      <span>Gesamt</span>
                      <span>{formatPrice(previewTotal)}</span>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      Vorschau: Preise können später abweichen.
                    </p>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const handleSave = async () => {
    if (status !== "authenticated") {
      await signIn();
      return;
    }
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/setups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${selectedSize?.label ?? "Setup"} / ${
            selectedLight?.label ?? ""
          }`.trim(),
          data: {
            sizeId,
            lightId,
            ventId,
            extras,
            total,
          },
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-6xl px-6 py-10 text-stone-800">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-3" style={{ color: "#2f3e36" }}>
            Grow Setup Customizer
          </h1>
          <p className="text-stone-600">
            Stelle dein Setup zusammen. Produkte werden spaeter mit echten
            Artikeln verknuepft.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                1. ZELT-GRÖßE
              </h2>
              {sizeError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {sizeError}
                </p>
              )}
              {sizeLoading ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={`size-skeleton-${index}`}
                      className="h-[74px] animate-pulse rounded-lg border border-black/10 bg-stone-100"
                    />
                  ))}
                </div>
              ) : sizeOptions.length === 0 ? (
                <p className="text-xs text-stone-500">
                  Keine Growboxen gefunden.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {sizeOptions.map((opt) => (
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
                      <div className="text-xs opacity-80">
                        {formatPrice(opt.price)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                2. LICHT
              </h2>
              {lightError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {lightError}
                </p>
              )}
              {lightLoading ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  {[...Array(3)].map((_, index) => (
                    <div
                      key={`light-skeleton-${index}`}
                      className="h-[74px] animate-pulse rounded-lg border border-black/10 bg-stone-100"
                    />
                  ))}
                </div>
              ) : (isAdmin ? lightOptions : LIGHT_OPTIONS).length === 0 ? (
                <p className="text-xs text-stone-500">
                  Kein Licht gefunden.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {(isAdmin ? lightOptions : LIGHT_OPTIONS).map((opt) => (
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
                      <div className="text-xs opacity-80">
                        {formatPrice(opt.price)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!lightCompatible && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Das ausgewaehlte Licht passt nicht zur Zelt-Groesse.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-black/10 bg-white p-5">
              <h2 className="text-sm font-semibold tracking-widest text-black/70 mb-4">
                3. ABLUFT
              </h2>
              {ventError && (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {ventError}
                </p>
              )}
              {ventLoading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[...Array(2)].map((_, index) => (
                    <div
                      key={`vent-skeleton-${index}`}
                      className="h-[74px] animate-pulse rounded-lg border border-black/10 bg-stone-100"
                    />
                  ))}
                </div>
              ) : (isAdmin ? ventOptions : VENT_OPTIONS).length === 0 ? (
                <p className="text-xs text-stone-500">Keine Abluft gefunden.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(isAdmin ? ventOptions : VENT_OPTIONS).map((opt) => (
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
                      <div className="text-xs opacity-80">
                        {formatPrice(opt.price)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!airCompatible && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Die Abluft passt nicht zum Anschlussdurchmesser der Growbox.
                </p>
              )}
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
                      <div className="text-xs opacity-80">
                        {formatPrice(opt.price)}
                      </div>
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
                onClick={handleSave}
                disabled={saving}
                className="w-full rounded-md bg-black px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving
                  ? "Speichern..."
                  : saved
                  ? "Gespeichert"
                  : "Setup speichern"}
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
