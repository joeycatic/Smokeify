"use client";

import PageLayout from "@/components/PageLayout";

const FEATURES = [
  {
    title: "Soft Light Spectrum",
    body: "Balanced LED array tuned for leafy and flowering cycles.",
  },
  {
    title: "Quiet Airflow",
    body: "Insulated ducting and baffle fans for low noise.",
  },
  {
    title: "Water Discipline",
    body: "Tray and drainage setup keeps roots steady and clean.",
  },
];

const OPTIONS = [
  "Timer Control",
  "Silent Fan Kit",
  "Humidity Monitor",
  "Extra Filter",
];

export default function TestingPage() {
  return (
    <PageLayout>
      <main className="min-h-screen bg-[#f4efe6] text-[#2b2a26]">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(83,107,77,0.18),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(168,138,96,0.18),transparent_45%)]" />
          <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-14">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="inline-flex items-center rounded-full border border-[#9b8a68] bg-[#f8f2e7] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#6c5d45]">
                  Botanical Luxe
                </p>
                <h1 className="mt-6 text-4xl font-semibold leading-tight text-[#2f3e36] md:text-5xl">
                  Terra Grow System
                </h1>
                <p className="mt-4 max-w-xl text-base text-[#4b4a45]">
                  A warm, sculpted grow environment with brass accents and soft
                  edges. Calm, curated, and built for steady harvests.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button className="rounded-full bg-[#9a7a4a] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(79,60,32,0.25)] transition hover:bg-[#87693f]">
                    Start Build
                  </button>
                  <button className="rounded-full border border-[#bfa57c] px-6 py-3 text-sm font-semibold text-[#6b5a3e] transition hover:border-[#9a7a4a]">
                    View Specs
                  </button>
                </div>
                <div className="mt-10 flex flex-wrap gap-6 text-sm text-[#5a584f]">
                  <div className="rounded-full bg-[#efe6d8] px-4 py-2">
                    60x60 to 100x100 cm
                  </div>
                  <div className="rounded-full bg-[#efe6d8] px-4 py-2">
                    LED 200-400W
                  </div>
                  <div className="rounded-full bg-[#efe6d8] px-4 py-2">
                    Silent Vent Kit
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-[#cbb58d] bg-white/80 p-4 shadow-[0_30px_70px_rgba(60,44,20,0.2)]">
                <div className="rounded-[24px] bg-[linear-gradient(130deg,#e7ddcd,#f9f4ea)] p-6">
                  <div className="aspect-[4/5] rounded-[22px] bg-[radial-gradient(circle_at_30%_30%,#cbd8c8,#9aa993_60%,#718067_100%)]" />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-[18px] border border-[#d9c9aa] bg-white px-5 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[#86745a]">
                      Package
                    </p>
                    <p className="text-lg font-semibold text-[#2f3e36]">
                      Terra Luxe Kit
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-[#2f3e36]">EUR 299</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-[#d8c7a5] bg-white/80 p-8 shadow-[0_20px_50px_rgba(70,52,28,0.15)]">
              <h2 className="text-2xl font-semibold text-[#2f3e36]">
                Crafted to grow calm
              </h2>
              <p className="mt-3 text-sm text-[#4e4b43]">
                Every component is tuned for quiet balance: warm light, soft air,
                and steady humidity.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {FEATURES.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl border border-[#e1d4bd] bg-[#faf6ee] p-4"
                  >
                    <p className="text-sm font-semibold text-[#3d4a41]">
                      {feature.title}
                    </p>
                    <p className="mt-2 text-xs text-[#5b564c]">
                      {feature.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#d8c7a5] bg-[#f7f0e3] p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[#7c6a4d]">
                Finish Options
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[#2f3e36]">
                Customize the ritual
              </h3>
              <div className="mt-6 grid gap-3">
                {OPTIONS.map((option) => (
                  <label
                    key={option}
                    className="flex items-center justify-between rounded-full border border-[#d4c4a7] bg-white px-4 py-3 text-sm text-[#524b40]"
                  >
                    <span>{option}</span>
                    <span className="h-3 w-3 rounded-full border border-[#b89a68] bg-[#f2e6d3]" />
                  </label>
                ))}
              </div>
              <button className="mt-6 w-full rounded-full bg-[#2f3e36] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#26312a]">
                Reserve Setup
              </button>
            </div>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
