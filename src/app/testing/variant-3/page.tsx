"use client";

import PageLayout from "@/components/PageLayout";

const CHIPS = ["Olive", "Brass", "Linen", "Stone"];

const PANELS = [
  {
    title: "Luxe Canopy",
    body: "Softened light dome with warm spectrum output.",
  },
  {
    title: "Air Ritual",
    body: "Layered exhaust and charcoal filtration.",
  },
  {
    title: "Water Poise",
    body: "Drain-ready base with brass overflow.",
  },
];

export default function TestingVariantThreePage() {
  return (
    <PageLayout>
      <main className="min-h-screen bg-[#f2ebe0] text-[#2b2a26]">
        <section className="mx-auto max-w-6xl px-6 pb-14 pt-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.8fr]">
            <div className="rounded-[28px] border border-[#d6c5a2] bg-white/70 p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-[#7c6a4d]">
                Botanical Edition
              </p>
              <h1 className="mt-4 text-4xl font-semibold text-[#2f3e36]">
                Verdant Ritual Suite
              </h1>
              <p className="mt-3 text-sm text-[#4d4a43]">
                A composed grow environment with olive accents and brass warmth.
                Built for steady cycles and quiet mornings.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-[#d4c4a7] bg-[#f8f2e7] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b5a3e]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <button className="mt-8 rounded-full bg-[#2f3e36] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#26312a]">
                Reserve Build
              </button>
            </div>

            <div className="rounded-[28px] border border-[#cdb68c] bg-[linear-gradient(140deg,#efe3cf,#f9f4ea)] p-6 shadow-[0_24px_60px_rgba(70,52,28,0.18)]">
              <div className="rounded-[22px] bg-white/80 p-5">
                <div className="aspect-[3/4] rounded-[18px] bg-[radial-gradient(circle_at_30%_20%,#ced8c7,#9aa78f_55%,#6d7a61_100%)]" />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {["LED 300W", "90x90 cm", "Silent Vent"].map((label) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#dbc7a6] bg-white px-3 py-2 text-center text-xs font-semibold text-[#5a564c]"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-6 lg:grid-cols-3">
            {PANELS.map((panel) => (
              <div
                key={panel.title}
                className="rounded-[24px] border border-[#d8c7a5] bg-[#faf5ec] p-6"
              >
                <p className="text-sm font-semibold text-[#2f3e36]">
                  {panel.title}
                </p>
                <p className="mt-2 text-xs text-[#5a564c]">{panel.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
