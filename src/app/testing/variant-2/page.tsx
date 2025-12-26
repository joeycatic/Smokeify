"use client";

import PageLayout from "@/components/PageLayout";

const STEPS = [
  {
    title: "Select Frame",
    body: "Choose a soft canvas enclosure tuned for quiet rooms.",
  },
  {
    title: "Tune Light",
    body: "Set spectrum warmth and daily rhythm with a brass dial.",
  },
  {
    title: "Balance Air",
    body: "Layered filters and gentle airflow keep the canopy steady.",
  },
];

export default function TestingVariantTwoPage() {
  return (
    <PageLayout>
      <main className="min-h-screen bg-[#f6f0e6] text-[#2d2b27]">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-14">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[26px] border border-[#d3c3a2] bg-white/70 p-8 shadow-[0_20px_50px_rgba(70,52,28,0.15)]">
              <p className="text-xs uppercase tracking-[0.25em] text-[#816c4c]">
                Botanical Atelier
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-[#2f3e36]">
                Terra Atelier Kit
              </h1>
              <p className="mt-3 text-sm text-[#4b4841]">
                Warm beige canvas, olive accents, and brass tones for an elevated
                grow ritual.
              </p>
              <div className="mt-6 grid gap-3">
                {["Quiet vents", "Soft canopy light", "Clean water flow"].map((item) => (
                  <div
                    key={item}
                    className="rounded-xl border border-[#e1d4bd] bg-[#faf6ee] px-4 py-3 text-sm text-[#3d4a41]"
                  >
                    {item}
                  </div>
                ))}
              </div>
              <button className="mt-8 w-full rounded-full bg-[#9a7a4a] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(79,60,32,0.2)] transition hover:bg-[#87693f]">
                Begin Build
              </button>
            </div>

            <div className="rounded-[30px] border border-[#cdb68c] bg-[radial-gradient(circle_at_40%_10%,#efe3cf,#f7f1e7_45%,#f0e6d6)] p-8">
              <div className="grid gap-6">
                {STEPS.map((step, index) => (
                  <div
                    key={step.title}
                    className="flex items-start gap-4 rounded-2xl border border-[#dbc7a6] bg-white/80 p-5"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#bfa57c] bg-[#f6ecda] text-sm font-semibold text-[#6e5a3e]">
                      0{index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#2f3e36]">
                        {step.title}
                      </p>
                      <p className="mt-1 text-xs text-[#5a564c]">{step.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-[20px] border border-[#cdb68c] bg-white px-6 py-5">
                <p className="text-xs uppercase tracking-[0.3em] text-[#7a6546]">
                  Estimated Total
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#2f3e36]">
                  EUR 349
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-[28px] border border-[#d8c7a5] bg-[#f8f2e7] p-8">
            <div className="grid gap-6 md:grid-cols-3">
              {["Brass Trim", "Olive Lining", "Linen Panels"].map((label) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[#e3d7c1] bg-white px-5 py-6 text-center text-sm font-semibold text-[#3b3a34]"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
