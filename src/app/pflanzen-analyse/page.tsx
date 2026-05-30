import type { Metadata } from "next";
import Link from "next/link";
import FooterNewsletter from "@/components/FooterNewsletter";
import PageLayout from "@/components/PageLayout";
import { EditorialGuideGrid } from "@/components/content/EditorialCards";
import { blogPosts } from "@/lib/blog";
import { getPlantAnalyzerDecisionSupport } from "@/lib/plantAnalyzerOutput";
import {
  buildPlantAnalyzerCaseLibraryPath,
  PLANT_ANALYZER_CASE_LIBRARY_PATH,
} from "@/lib/plantAnalyzerPaths";
import { prisma } from "@/lib/prisma";
import PlantAnalyzerClient from "@/app/pflanzen-analyzer/PlantAnalyzerClient";

export const metadata: Metadata = {
  title: "Pflanzenanalyse | Smokeify",
  description:
    "Lade ein Pflanzenfoto hoch und erhalte eine strukturierte Smokeify Analyse mit Prüfchecks, Pflegehinweisen und passenden Produkten.",
  alternates: {
    canonical: "/pflanzen-analyse",
  },
};

export const dynamic = "force-dynamic";

function getFeaturedCases() {
  return prisma.plantAnalysisRun.findMany({
    where: {
      reviewStatus: "REVIEWED_OK",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 3,
    select: {
      id: true,
      species: true,
      confidence: true,
      healthStatus: true,
      outputJson: true,
      issues: {
        orderBy: {
          position: "asc",
        },
        select: {
          id: true,
          label: true,
        },
      },
    },
  });
}

export default async function PlantAnalyzerPage() {
  const featuredCasesPromise = getFeaturedCases();

  const clusterLabelById = {
    setup: "Setup Guide",
    diagnosis: "Analyse Guide",
    climate: "Klima Guide",
    nutrition: "Nährstoff Guide",
  } as const;

  const symptomGuides = blogPosts
    .filter((post) =>
      ["diagnosis", "climate", "nutrition"].includes(post.cluster),
    )
    .slice(0, 3)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      href: `/blog/${post.slug}`,
      publishedAt: post.publishedAt,
      readingTimeMin: post.readingTimeMin,
      eyebrow: clusterLabelById[post.cluster],
    }));

  return (
    <PageLayout commerce>
      <div className="smk-analyzer-gv-theme overflow-x-clip">
        <div className="mx-auto max-w-7xl pb-8 pt-0 text-[color:var(--smk-text)] sm:px-6 sm:pb-12 sm:pt-6">
          <div className="px-1 sm:px-0">
            <PlantAnalyzerClient />
          </div>

          <div className="mt-8 hidden space-y-8 px-4 sm:block sm:px-0">
            <section className="gv-glass rounded-[30px] px-5 py-6 sm:px-6">
              <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
                Diagnose mit Kontext
              </p>
              <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)] sm:text-3xl">
                    Unsichere Fälle sollten nicht im Blindflug in den Warenkorb gehen
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--gv-text-muted)]">
                    Der Smokeify Analyzer trennt Beobachtung, mögliche Ursachen und
                    nächste Schritte. Wenn ein Fall nicht eindeutig ist, helfen die
                    Symptom-Guides dabei, Klima, pH oder Gießmuster ruhiger zu prüfen.
                  </p>
                </div>
                <Link
                  href="/blog"
                  className="inline-flex items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/35"
                >
                  Alle Guides ansehen
                </Link>
              </div>
            </section>

            <EditorialGuideGrid
              eyebrow="Problem & Symptome"
              title="Diese Guides decken die häufigsten Analyzer-Fälle bereits ab"
              description="Gelbe oder hängende Blätter, hohe Luftfeuchte und pH-Themen haben jetzt eigene Entscheidungs- und Diagnoseguides."
              guides={symptomGuides}
            />

            <FeaturedCases casesPromise={featuredCasesPromise} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
              <section className="gv-panel rounded-[30px] px-5 py-6 sm:px-6">
                <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
                  Fallbibliothek
                </p>
                <h2 className="mt-2 font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)]">
                  Kuratierte Analyzer-Fälle statt blindem Symptom-Raten
                </h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--gv-text-muted)]">
                  Sieh dir veröffentlichte Community-Fälle mit sicheren nächsten
                  Schritten an oder reiche später deinen eigenen Fall anonymisiert
                  für die Bibliothek ein.
                </p>
                <Link
                  href={PLANT_ANALYZER_CASE_LIBRARY_PATH}
                  className="mt-5 inline-flex items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/35"
                >
                  Fallbibliothek öffnen
                </Link>
              </section>

              <div className="gv-glass rounded-[30px] p-6">
                <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
                  Newsletter
                </p>
                <h2 className="mt-2 font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)]">
                  Neue Diagnose-Guides und Pflanzenfälle
                </h2>
                <p className="mt-3 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                  Erhalte neue Troubleshooting-Guides, veröffentlichte
                  Analyzer-Fälle und vorsichtige nächste Schritte per E-Mail.
                </p>
                <div className="mt-5">
                  <FooterNewsletter />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

async function FeaturedCases({
  casesPromise,
}: {
  casesPromise: ReturnType<typeof getFeaturedCases>;
}) {
  const cases = await casesPromise;
  if (cases.length === 0) return null;

  return (
    <section className="gv-panel rounded-[30px] px-5 py-6 sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-[family:var(--font-jetbrains-mono)] text-xs uppercase tracking-[0.22em] text-[color:var(--gv-lime)]">
            Community Cases
          </p>
          <h2 className="mt-2 font-[family:var(--font-syne)] text-2xl font-bold tracking-[-0.05em] text-[color:var(--gv-text)]">
            Neu veröffentlichte Analyzer-Fälle
          </h2>
        </div>
        <Link
          href={PLANT_ANALYZER_CASE_LIBRARY_PATH}
          className="inline-flex items-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] px-5 py-3 text-sm font-semibold text-[color:var(--gv-text)] hover:border-[color:var(--gv-lime)]/35"
        >
          Alle Fälle ansehen
        </Link>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {cases.map((entry) => {
          const support = getPlantAnalyzerDecisionSupport(entry.outputJson);

          return (
            <Link
              key={entry.id}
              href={buildPlantAnalyzerCaseLibraryPath(entry.id)}
              className="gv-glass rounded-[24px] p-4 hover:border-[color:var(--gv-lime)]/35"
            >
              <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--gv-lime)]">
                {entry.species}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[color:var(--gv-text)]">
                {entry.healthStatus === "CRITICAL"
                  ? "Kritischer Fall"
                  : entry.healthStatus === "HEALTHY"
                    ? "Stabiler Verlauf"
                    : "Prüffall"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--gv-text-muted)]">
                {support?.summary ??
                  entry.issues[0]?.label ??
                  "Geprüfte Analyse mit strukturierten nächsten Schritten."}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
