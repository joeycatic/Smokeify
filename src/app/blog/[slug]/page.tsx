import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts, getBlogPost } from "@/lib/blog";
import PageLayout from "@/components/PageLayout";
import GrowboxEinsteigerGuide from "@/content/blog/growbox-einsteiger-guide";
import Growbox2Pflanzen from "@/content/blog/growbox-2-pflanzen";
import DuengerVergleich from "@/content/blog/duenger-vergleich";
import PflanzenanalyseGelbeBlaetter from "@/content/blog/pflanzenanalyse-gelbe-blaetter";
import AbluftSetupGuide from "@/content/blog/abluft-setup-guide";
import LedGrowlampenVergleich from "@/content/blog/led-growlampen-vergleich";
import CustomizerGrowboxSetup from "@/content/blog/customizer-growbox-setup";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://www.smokeify.de";

const contentMap: Record<string, React.ComponentType> = {
  "growbox-einsteiger-guide": GrowboxEinsteigerGuide,
  "growbox-2-pflanzen": Growbox2Pflanzen,
  "duenger-vergleich": DuengerVergleich,
  "pflanzenanalyse-gelbe-blaetter": PflanzenanalyseGelbeBlaetter,
  "abluft-setup-guide": AbluftSetupGuide,
  "led-growlampen-vergleich": LedGrowlampenVergleich,
  "customizer-growbox-setup": CustomizerGrowboxSetup,
};

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};
  const canonical = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical,
      languages: { "de-DE": canonical, "x-default": canonical },
    },
    openGraph: {
      type: "article",
      url: `${siteUrl}${canonical}`,
      title: post.title,
      description: post.description,
      publishedTime: new Date(post.publishedAt).toISOString(),
      locale: "de_DE",
    },
  };
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  const Content = contentMap[slug];
  if (!post || !Content) notFound();

  return (
    <PageLayout commerce>
      <article className="mx-auto max-w-4xl space-y-8 text-[var(--smk-text)]">
        <nav className="flex items-center gap-2 text-sm text-[var(--smk-text-dim)]">
          <Link href="/" className="transition hover:text-[var(--smk-text)]">
            Home
          </Link>
          <span>/</span>
          <Link href="/blog" className="transition hover:text-[var(--smk-text)]">
            Blog
          </Link>
          <span>/</span>
          <span className="line-clamp-1 text-[var(--smk-text-muted)]">{post.title}</span>
        </nav>

        <header className="rounded-[40px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_top_left,rgba(241,198,132,0.18),transparent_26%),linear-gradient(135deg,rgba(24,20,17,0.99),rgba(12,11,10,1))] px-6 py-10 shadow-[0_30px_80px_rgba(0,0,0,0.34)] sm:px-10">
          <p className="smk-kicker">
            {formatDate(post.publishedAt)} · {post.readingTimeMin} Min. Lesezeit
          </p>
          <h1 className="smk-heading mt-4 text-4xl leading-tight text-[var(--smk-text)] sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--smk-text-muted)]">
            {post.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="smk-chip text-[10px]">
                {tag}
              </span>
            ))}
          </div>
        </header>

        <div
          className="
            smk-panel rounded-[34px] px-6 py-8 leading-relaxed sm:px-9
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-[-0.04em] [&_h2]:text-[var(--smk-text)]
            [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-[var(--smk-text)]
            [&_p]:mb-4 [&_p]:text-base [&_p]:leading-7 [&_p]:text-[var(--smk-text-muted)]
            [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5
            [&_ol]:mb-4 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5
            [&_li]:text-base [&_li]:leading-7 [&_li]:text-[var(--smk-text-muted)]
            [&_strong]:font-semibold [&_strong]:text-[var(--smk-text)]
          "
        >
          <Content />
        </div>

        <div className="border-t border-[var(--smk-border)] pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--smk-text-muted)] transition hover:text-[var(--smk-text)]"
          >
            ← Zurück zum Blog
          </Link>
        </div>
      </article>
    </PageLayout>
  );
}
