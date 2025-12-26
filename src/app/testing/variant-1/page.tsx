"use client";

import PageLayout from "@/components/PageLayout";

const FEATURES = [
  "Warm 3000K spectrum",
  "Quiet airflow module",
  "Humidity control",
  "Modular trays",
];

export default function TestingVariantOnePage() {
  return (
    <PageLayout>
      <main className="min-h-screen bg-[#f3ece0] text-[#2d2b27]">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(98,122,88,0.18),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(181,146,98,0.2),transparent_45%)]" />
          <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-14">
            <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="inline-flex items-center rounded-full border border-[#b79a6b] bg-[#faf3e6] px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#7a6340]">
                  Botanical Luxe
                </p>
                <h1 className="mt-6 text-5xl font-semibold leading-tight text-[#2f3e36]">
                  Solara Grow Studio
                </h1>
                <p className="mt-4 max-w-xl text-base text-[#4d4a43]">
                  Warm, sculpted, and quiet. A refined grow chamber designed for
                  calm routines and bold harvests.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <button className="rounded-full bg-[#9a7a4a] px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,60,32,0.25)] transition hover:bg-[#87693f]">
                    Build Your Kit
                  </button>
                  <button className="rounded-full border border-[#c8ae83] px-7 py-3 text-sm font-semibold text-[#6b5a3e] transition hover:border-[#9a7a4a]">
                    View Details
                  </button>
                </div>
                <div className="mt-10 grid gap-3 sm:grid-cols-2">
                  {FEATURES.map((feature) => (
                    <div
                      key={feature}
                      className="rounded-full border border-[#d8c6a4] bg-[#f7efe2] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#6d5b3f]"
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[#cfb78b] bg-white/80 p-5 shadow-[0_30px_70px_rgba(60,44,20,0.2)]">
                <div className="rounded-[24px] bg-[linear-gradient(145deg,#eee2cf,#fbf7ef)] p-6">
                  <div className="aspect-[4/5] rounded-[22px] bg-[radial-gradient(circle_at_30%_30%,#cbd8c8,#97a68f_55%,#68765f_100%)]" />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-[18px] border border-[#dbc7a6] bg-white px-5 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[#86745a]">
                      Signature
                    </p>
                    <p className="text-lg font-semibold text-[#2f3e36]">
                      Solara Luxe
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-[#2f3e36]">EUR 329</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-[#d8c7a5] bg-white/80 p-8 shadow-[0_20px_50px_rgba(70,52,28,0.15)]">
              <h2 className="text-2xl font-semibold text-[#2f3e36]">
                Crafted for balance
              </h2>
              <p className="mt-3 text-sm text-[#4e4b43]">
                Gentle light, controlled air, and steady moisture deliver a calm,
                repeatable grow ritual.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  "Soft LED array",
                  "Silent exhaust",
                  "Moisture tray",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#e1d4bd] bg-[#faf6ee] p-4 text-sm text-[#3d4a41]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#d8c7a5] bg-[#f7f0e3] p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[#7c6a4d]">
                Curated Options
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[#2f3e36]">
                Personalize the finish
              </h3>
              <div className="mt-6 space-y-3">
                {["Brass timer", "Olive piping", "Extra filter"].map((option) => (
                  <div
                    key={option}
                    className="flex items-center justify-between rounded-full border border-[#d4c4a7] bg-white px-4 py-3 text-sm text-[#524b40]"
                  >
                    <span>{option}</span>
                    <span className="h-3 w-3 rounded-full border border-[#b89a68] bg-[#f2e6d3]" />
                  </div>
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
