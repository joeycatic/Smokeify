"use client";

import PageLayout from "@/components/PageLayout";

const STATS = [
  { label: "Footprint", value: "90x90 cm" },
  { label: "Light", value: "LED 300W" },
  { label: "Vent", value: "Silent kit" },
];

export default function TestingVariantFivePage() {
  return (
    <PageLayout>
      <main className="min-h-screen bg-[#ecf2ee] text-[#1f2a22]">
        <section className="mx-auto max-w-6xl px-6 pb-12 pt-14">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-[#b7d1c1] bg-white/80 p-8 shadow-[0_20px_50px_rgba(21,72,47,0.18)]">
              <p className="text-xs uppercase tracking-[0.3em] text-[#2d6b48]">
                Forest Atelier
              </p>
              <h1 className="mt-4 text-4xl font-semibold text-[#1f2f23]">
                Verdant Frame
              </h1>
              <p className="mt-3 text-sm text-[#3b4a40]">
                A lush green palette paired with soft neutrals and brass accents.
              </p>
              <div className="mt-6 grid gap-3">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between rounded-2xl border border-[#cde2d6] bg-[#f6fbf7] px-4 py-3 text-sm text-[#2c3f34]"
                  >
                    <span className="uppercase tracking-[0.2em] text-[#4c6d57]">
                      {stat.label}
                    </span>
                    <span className="font-semibold text-[#1f2f23]">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>
              <button className="mt-8 w-full rounded-full bg-[#1f6a3f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#185a36]">
                Build the ritual
              </button>
            </div>

            <div className="rounded-[30px] border border-[#a8c8b3] bg-[linear-gradient(140deg,#e0efe4,#f7fbf8)] p-6">
              <div className="rounded-[22px] border border-[#cbe1d1] bg-white/90 p-5">
                <div className="aspect-[3/4] rounded-[18px] bg-[radial-gradient(circle_at_30%_30%,#cfe1d2,#92b29a_55%,#4e7c60_100%)]" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {["Olive canvas", "Brass dial", "Quiet air", "Clean water"].map(
                  (label) => (
                    <div
                      key={label}
                      className="rounded-xl border border-[#cbe1d1] bg-white px-3 py-2 text-center text-xs font-semibold text-[#3a4b40]"
                    >
                      {label}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-[28px] border border-[#b7d1c1] bg-[#f2f8f4] p-8">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#2d6b48]">
                  Example Card
                </p>
                <div className="mt-4 rounded-2xl border border-[#cbe1d1] bg-white p-4 shadow-[0_10px_25px_rgba(21,72,47,0.12)]">
                  <div className="aspect-[4/3] rounded-xl bg-[radial-gradient(circle_at_30%_30%,#cfe1d2,#92b29a_55%,#4e7c60_100%)]" />
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[#4c6d57]">
                    Smokeify
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[#1f2f23]">
                    Verdant 100x100 Kit
                  </p>
                  <p className="mt-2 text-sm text-[#3d4b41]">EUR 299</p>
                  <button className="mt-4 w-full rounded-full bg-[#1f6a3f] px-4 py-2 text-sm font-semibold text-white">
                    Add to cart
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#cbe1d1] bg-white/80 p-6">
                <h3 className="text-xl font-semibold text-[#1f2f23]">
                  Soft green interior
                </h3>
                <p className="mt-2 text-sm text-[#3d4b41]">
                  Calm, neutral base tones with deeper greens for contrast and
                  focus.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["Sage", "Moss", "Forest", "Olive"].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full border border-[#cde2d6] bg-[#f4faf6] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#2d6b48]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
