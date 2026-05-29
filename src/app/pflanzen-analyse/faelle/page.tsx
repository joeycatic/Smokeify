import type { Metadata } from "next";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import EmptyState from "@/components/common/EmptyState";
import { prisma } from "@/lib/prisma";
import { getPlantAnalyzerDecisionSupport } from "@/lib/plantAnalyzerOutput";
import { buildPlantAnalyzerCaseLibraryPath } from "@/lib/plantAnalyzerPaths";

export const metadata: Metadata = {
  title: "Pflanzenanalyse Fälle | Smokeify",
  description:
    "Smokeify Fallbibliothek für geprüfte Pflanzenanalyse-Beispiele und strukturierte Learnings.",
  alternates: {
    canonical: "/pflanzen-analyse/faelle",
  },
};

export const dynamic = "force-dynamic";

const toHealthLabel = (value: "HEALTHY" | "WARNING" | "CRITICAL") => {
  if (value === "HEALTHY") return "Stabil";
  if (value === "CRITICAL") return "Kritisch";
  return "Prüfen";
};

export default async function PlantAnalyzerCaseLibraryPage() {
  const cases = await prisma.plantAnalysisRun.findMany({
    where: {
      reviewStatus: "REVIEWED_OK",
    },
    orderBy: { createdAt: "desc" },
    take: 18,
    include: {
      issues: {
        orderBy: { position: "asc" },
      },
    },
  });

  return (
    <PageLayout commerce>
      <div className="space-y-6 text-[var(--smk-text)]">
        <section className="rounded-[40px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_left,rgba(241,198,132,0.18),transparent_26%),linear-gradient(135deg,rgba(24,20,17,0.99),rgba(12,11,10,1))] px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.34)] sm:px-10">
          <p className="smk-kicker">Smokeify Fallbibliothek</p>
          <h1 className="smk-heading mt-4 text-4xl text-[var(--smk-text)] sm:text-5xl">
            Geprüfte Analysefälle für bessere Entscheidungen.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
            Hier erscheinen Smokeify Pflanzenanalysen erst nach Review. So bleibt
            die öffentliche Bibliothek kuratiert und getrennt vom privaten Verlauf.
          </p>
        </section>

        {cases.length === 0 ? (
          <EmptyState
            eyebrow="Noch keine öffentlichen Fälle"
            title="Die Fallbibliothek wartet auf geprüfte Smokeify Analysen."
            description="Private Analyseverläufe bleiben privat. Öffentliche Beispiele werden erst nach Review freigeschaltet."
            actions={[
              { label: "Analyse starten", href: "/pflanzen-analyse", tone: "primary" },
            ]}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cases.map((item) => {
              const support = getPlantAnalyzerDecisionSupport(item.outputJson);
              return (
                <Link
                  key={item.id}
                  href={buildPlantAnalyzerCaseLibraryPath(item.id)}
                  className="group rounded-[30px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.065)]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="smk-kicker">{toHealthLabel(item.healthStatus)}</p>
                    <span className="rounded-full border border-[var(--smk-border)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--smk-text-muted)]">
                      {Math.round(item.confidence * 100)}%
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[var(--smk-text)] group-hover:text-[var(--smk-accent)]">
                    {item.species}
                  </h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--smk-text-muted)]">
                    {support?.summary ?? item.issues[0]?.label ?? "Geprüfte Analyse"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
