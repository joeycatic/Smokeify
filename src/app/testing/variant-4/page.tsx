"use client";

import PageLayout from "@/components/PageLayout";

const FEATURES = [
  "Emerald airflow",
  "Olive humidity",
  "Forest light mix",
];

export default function TestingVariantFourPage() {
  return (
    <PageLayout>
      <main className="min-h-screen bg-[#eef5ef] text-[#1f2a22]">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(24,90,54,0.25),transparent_50%),radial-gradient(circle_at_85%_20%,rgba(61,148,95,0.2),transparent_45%)]" />
          <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <p className="inline-flex items-center rounded-full border border-[#2f7a4a] bg-[#e2f1e6] px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#1f6a3f]">
                  Green Luxe
                </p>
                <h1 className="mt-6 text-5xl font-semibold leading-tight text-[#1f2f23]">
                  Evergreen Studio
                </h1>
                <p className="mt-4 max-w-xl text-base text-[#354339]">
                  A verdant grow chamber with clean lines, deep greens, and warm
                  brass touches.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <button className="rounded-full bg-[#1f6a3f] px-7 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(24,90,54,0.28)] transition hover:bg-[#185a36]">
                    Start Build
                  </button>
                  <button className="rounded-full border border-[#2f7a4a] px-7 py-3 text-sm font-semibold text-[#1f6a3f] transition hover:border-[#185a36]">
                    View Specs
                  </button>
                </div>
                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  {FEATURES.map((feature) => (
                    <div
                      key={feature}
                      className="rounded-full border border-[#b9d6c3] bg-[#f6fbf7] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#2a4a34]"
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[30px] border border-[#a8c8b3] bg-white/80 p-5 shadow-[0_30px_70px_rgba(24,90,54,0.2)]">
                <div className="rounded-[24px] bg-[linear-gradient(145deg,#dfeee2,#f3f9f4)] p-6">
                  <div className="aspect-[4/5] rounded-[22px] bg-[radial-gradient(circle_at_30%_30%,#cfe1d2,#92b29a_55%,#4e7c60_100%)]" />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-[18px] border border-[#c6ddcf] bg-white px-5 py-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[#4c6d57]">
                      Package
                    </p>
                    <p className="text-lg font-semibold text-[#1f2f23]">
                      Evergreen Kit
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-[#1f2f23]">EUR 339</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-[#b9d6c3] bg-white/80 p-8">
              <h2 className="text-2xl font-semibold text-[#1f2f23]">
                Natural control
              </h2>
              <p className="mt-3 text-sm text-[#3d4b41]">
                Deep green accents meet soft beige panels for a calm, premium
                grow experience.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {["Air ritual", "Light balance", "Water flow"].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-[#d7e6db] bg-[#f6fbf7] p-4 text-sm text-[#2c3f34]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#b9d6c3] bg-[#f4faf6] p-8">
              <p className="text-xs uppercase tracking-[0.28em] text-[#4c6d57]">
                Example Card
              </p>
              <div className="mt-4 rounded-2xl border border-[#cbe1d1] bg-white p-4 shadow-[0_10px_25px_rgba(24,90,54,0.12)]">
                <div className="aspect-[4/3] rounded-xl bg-[radial-gradient(circle_at_30%_30%,#cfe1d2,#92b29a_55%,#4e7c60_100%)]" />
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[#4c6d57]">
                  Smokeify
                </p>
                <p className="mt-1 text-lg font-semibold text-[#1f2f23]">
                  Evergreen 80x80 Kit
                </p>
                <p className="mt-2 text-sm text-[#3d4b41]">EUR 219</p>
                <button className="mt-4 w-full rounded-full bg-[#1f6a3f] px-4 py-2 text-sm font-semibold text-white">
                  Add to cart
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
