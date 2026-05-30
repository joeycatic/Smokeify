import type { Metadata } from "next";
import Link from "next/link";
import { blogClusters, blogPosts } from "@/lib/blog";
import PageLayout from "@/components/PageLayout";

export const metadata: Metadata = {
  title: "Smokeify Guides – Setup, Analyse & Indoor-Growing",
  description:
    "Smokeify Guides für Growbox-Setup, Pflanzenanalyse, Abluft, Licht, Dünger und Kaufentscheidungen.",
  alternates: {
    canonical: "/blog",
    languages: { "de-DE": "/blog", "x-default": "/blog" },
  },
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default function BlogPage() {
  const featured = blogPosts.filter((post) => post.featured);
  const postsByCluster = new Map(
    blogClusters.map((cluster) => [
      cluster.id,
      blogPosts.filter((post) => post.cluster === cluster.id),
    ]),
  );

  return (
    <PageLayout commerce>
      <div className="space-y-8 text-[var(--smk-text)]">
        <section className="relative overflow-hidden rounded-[42px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_14%_16%,rgba(241,198,132,0.2),transparent_30%),radial-gradient(circle_at_84%_18%,rgba(91,117,82,0.16),transparent_28%),linear-gradient(135deg,rgba(23,20,17,0.99),rgba(12,11,10,1))] px-6 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.38)] sm:px-10">
          <p className="smk-kicker">Smokeify Guides</p>
          <h1 className="smk-heading mt-4 max-w-4xl text-5xl leading-[0.95] text-[var(--smk-text)] sm:text-6xl">
            Wissen, das direkt in bessere Setup-Entscheidungen führt.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
            Clustered Guides für Katalog, Konfigurator und Pflanzenanalyse:
            weniger Raten, klarere Checks und Smokeify Produktempfehlungen mit Kontext.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/customizer" className="smk-button-primary rounded-full px-5 py-3 text-sm font-semibold">
              Setup konfigurieren
            </Link>
            <Link href="/pflanzen-analyse" className="smk-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
              Pflanzenanalyse starten
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {featured.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group smk-panel rounded-[32px] p-6 transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)]"
            >
              <p className="smk-kicker">{formatDate(post.publishedAt)}</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.05em] text-[var(--smk-text)] group-hover:text-[var(--smk-accent)]">
                {post.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-[var(--smk-text-muted)]">
                {post.excerpt}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="smk-chip text-[10px]">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {blogClusters.map((cluster) => (
            <div key={cluster.id} className="smk-surface rounded-[28px] p-5">
              <p className="smk-kicker">{cluster.label}</p>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[var(--smk-text)]">
                {cluster.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
                {cluster.description}
              </p>
            </div>
          ))}
        </section>

        <section className="space-y-6">
          {blogClusters.map((cluster) => {
            const posts = postsByCluster.get(cluster.id) ?? [];
            if (posts.length === 0) return null;
            return (
              <div key={cluster.id} className="space-y-4">
                <div>
                  <p className="smk-kicker">{cluster.label}</p>
                  <h2 className="smk-heading mt-2 text-3xl text-[var(--smk-text)] sm:text-4xl">
                    {cluster.title}
                  </h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {posts.map((post) => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="group rounded-[30px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)] hover:bg-[rgba(255,255,255,0.065)]"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--smk-text-dim)]">
                        {formatDate(post.publishedAt)} · {post.readingTimeMin} Min.
                      </p>
                      <h3 className="mt-3 text-xl font-semibold leading-tight tracking-[-0.04em] text-[var(--smk-text)] group-hover:text-[var(--smk-accent)]">
                        {post.title}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--smk-text-muted)]">
                        {post.excerpt}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </PageLayout>
  );
}
