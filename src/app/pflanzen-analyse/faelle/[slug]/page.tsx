import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { prisma } from "@/lib/prisma";
import {
  getPlantAnalyzerCachedSuggestions,
  getPlantAnalyzerDecisionSupport,
} from "@/lib/plantAnalyzerOutput";
import { PLANT_ANALYZER_CASE_LIBRARY_PATH } from "@/lib/plantAnalyzerPaths";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = await prisma.plantAnalysisRun.findFirst({
    where: { id: slug, reviewStatus: "REVIEWED_OK" },
    select: { species: true },
  });

  if (!item) {
    return { title: "Analysefall | Smokeify" };
  }

  return {
    title: `${item.species} Analysefall | Smokeify`,
    alternates: {
      canonical: `/pflanzen-analyse/faelle/${slug}`,
    },
  };
}

const toHealthLabel = (value: "HEALTHY" | "WARNING" | "CRITICAL") => {
  if (value === "HEALTHY") return "Stabil";
  if (value === "CRITICAL") return "Kritisch";
  return "Prüfen";
};

export default async function PlantAnalyzerCasePage({ params }: PageProps) {
  const { slug } = await params;
  const item = await prisma.plantAnalysisRun.findFirst({
    where: {
      id: slug,
      reviewStatus: "REVIEWED_OK",
    },
    include: {
      issues: {
        orderBy: { position: "asc" },
      },
    },
  });

  if (!item) notFound();

  const support = getPlantAnalyzerDecisionSupport(item.outputJson);
  const suggestions = getPlantAnalyzerCachedSuggestions(item.outputJson);

  return (
    <PageLayout commerce>
      <article className="space-y-6 text-[var(--smk-text)]">
        <section className="rounded-[40px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_left,rgba(241,198,132,0.18),transparent_26%),linear-gradient(135deg,rgba(24,20,17,0.99),rgba(12,11,10,1))] px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.34)] sm:px-10">
          <Link
            href={PLANT_ANALYZER_CASE_LIBRARY_PATH}
            className="text-sm font-semibold text-[var(--smk-text-muted)] transition hover:text-[var(--smk-text)]"
          >
            Zur Fallbibliothek
          </Link>
          <p className="smk-kicker mt-6">{toHealthLabel(item.healthStatus)}</p>
          <h1 className="smk-heading mt-4 text-4xl text-[var(--smk-text)] sm:text-5xl">
            {item.species}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
            {support?.summary ?? item.issues[0]?.label ?? "Geprüfter Smokeify Analysefall."}
          </p>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
          <section className="smk-panel rounded-[32px] p-5 sm:p-6">
            <p className="smk-kicker">Befunde und Checks</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-semibold text-[var(--smk-text)]">Befunde</p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--smk-text-muted)]">
                  {item.issues.map((issue) => (
                    <li key={issue.id}>{issue.label} · {Math.round(issue.confidence * 100)}%</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="text-sm font-semibold text-[var(--smk-text)]">Sofortmaßnahmen</p>
                <ul className="mt-3 space-y-2 text-sm text-[var(--smk-text-muted)]">
                  {(support?.immediateActions ?? []).map((action) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
            </div>

            {support?.verificationChecks?.length ? (
              <div className="mt-4 space-y-2">
                {support.verificationChecks.map((check) => (
                  <div
                    key={check.id}
                    className="rounded-[22px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--smk-text)]">
                      {check.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[var(--smk-text-muted)]">
                      {check.detail}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <aside className="space-y-4">
            <div className="smk-panel rounded-[32px] p-5">
              <p className="smk-kicker">Smokeify Kontext</p>
              <p className="mt-3 text-sm leading-6 text-[var(--smk-text-muted)]">
                Dieser Fall wurde als öffentlich geeignet markiert. Private
                Nutzerdaten und nicht geprüfte Verläufe bleiben ausgeschlossen.
              </p>
            </div>

            {suggestions?.productSuggestions.length ? (
              <div className="smk-panel rounded-[32px] p-5">
                <p className="smk-kicker">Produktpfade</p>
                <div className="mt-4 space-y-2">
                  {suggestions.productSuggestions.slice(0, 4).map((product) => (
                    <Link
                      key={product.id}
                      href={`/products/${product.handle}`}
                      className="block rounded-2xl border border-[var(--smk-border)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-sm font-semibold text-[var(--smk-text)] transition hover:border-[var(--smk-border-strong)] hover:text-[var(--smk-accent)]"
                    >
                      {product.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </article>
    </PageLayout>
  );
}
