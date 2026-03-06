import type { Metadata } from "next";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import PlantAnalyzerClient from "./PlantAnalyzerClient";

export const metadata: Metadata = {
  title: "Pflanzen Analyzer | Smokeify",
  description:
    "Foto hochladen, einfache Pflanzenanalyse erhalten und direkt passende Produkte und Guides von Smokeify entdecken.",
  alternates: {
    canonical: "/pflanzen-analyzer",
  },
  openGraph: {
    title: "Pflanzen Analyzer | Smokeify",
    description:
      "Schnelle Website-Analyse mit Foto-Upload, Problemschätzung und passenden Shop-Empfehlungen.",
  },
  twitter: {
    title: "Pflanzen Analyzer | Smokeify",
    description:
      "Schnelle Website-Analyse mit Foto-Upload, Problemschätzung und passenden Shop-Empfehlungen.",
  },
};

export default function PlantAnalyzerPage() {
  return (
    <PageLayout>
      <div className="bg-[radial-gradient(circle_at_top,rgba(20,83,45,0.08),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f8fafc_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
          <section className="relative mb-8 overflow-hidden rounded-[32px] border border-[#244136] bg-[#16382d] px-6 py-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] sm:px-8 sm:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(228,197,108,0.20),transparent_24%),radial-gradient(circle_at_82%_16%,rgba(127,180,156,0.18),transparent_28%),linear-gradient(135deg,rgba(15,35,28,0.12)_0%,rgba(15,35,28,0)_55%,rgba(228,197,108,0.10)_100%)]" />
            <div className="absolute -right-12 top-8 h-36 w-36 rounded-full bg-[#e4c56c]/15 blur-3xl sm:h-48 sm:w-48" />
            <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-emerald-300/10 blur-3xl sm:h-40 sm:w-40" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f5e8bc]">
                Website Analyzer
              </p>
              <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
                Pflanze fotografieren, Problem schätzen, Produkte direkt finden.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/84 sm:text-base">
                Diese Website-Version ist bewusst einfach gehalten: Foto hochladen,
                kurze Diagnose erhalten und direkt zu passenden Produkten, Guides
                und der tieferen Analyse in der Smokeify App weitergehen.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#E4C56C] px-5 py-3 text-sm font-semibold text-[#20342b] transition hover:bg-[#edd48f]"
                >
                  Produkte entdecken
                </Link>
                <Link
                  href="/blog"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  Guides lesen
                </Link>
              </div>
            </div>
          </section>

          <PlantAnalyzerClient />
        </div>
      </div>
    </PageLayout>
  );
}
