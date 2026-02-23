import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts, getBlogPost } from "@/lib/blog";
import PageLayout from "@/components/PageLayout";
import GrowboxEinsteigerGuide from "@/content/blog/growbox-einsteiger-guide";
import Growbox2Pflanzen from "@/content/blog/growbox-2-pflanzen";
import DuengerVergleich from "@/content/blog/duenger-vergleich";

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://www.smokeify.de";

const contentMap: Record<string, React.ComponentType> = {
  "growbox-einsteiger-guide": GrowboxEinsteigerGuide,
  "growbox-2-pflanzen": Growbox2Pflanzen,
  "duenger-vergleich": DuengerVergleich,
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
    <PageLayout>
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-stone-400">
          <Link href="/" className="hover:text-stone-600">
            Home
          </Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-stone-600">
            Blog
          </Link>
          <span>/</span>
          <span className="text-stone-600">{post.title}</span>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
            {formatDate(post.publishedAt)} · {post.readingTimeMin} Min. Lesezeit
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-stone-900 sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-500">{post.description}</p>
        </header>

        {/* Article body */}
        <div
          className="
            text-stone-800 leading-relaxed
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-stone-900
            [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-stone-800
            [&_p]:mb-4 [&_p]:text-base
            [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1.5
            [&_ol]:mb-4 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5
            [&_li]:text-base [&_li]:leading-relaxed
            [&_strong]:font-semibold [&_strong]:text-stone-900
          "
        >
          <Content />
        </div>

        {/* Back link */}
        <div className="mt-12 border-t border-stone-200 pt-8">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900"
          >
            ← Zurück zum Blog
          </Link>
        </div>
      </div>
    </PageLayout>
  );
}
