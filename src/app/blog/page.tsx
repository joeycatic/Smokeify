import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/blog";
import PageLayout from "@/components/PageLayout";

export const metadata: Metadata = {
  title: "Blog – Indoor Guides & Tipps",
  description:
    "Pflanzenzelt Guides, Dünger-Vergleiche und Einsteiger-Tipps für deinen Indoor-Garten. Alles, was du für erfolgreichen Indoor-Anbau wissen musst.",
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
  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-stone-900">Blog</h1>
        <p className="mt-3 text-base text-stone-500">
          Guides, Vergleiche und Tipps rund um Indoor-Anbau und Pflanzenzelt-Setup.
        </p>

        <div className="mt-10 space-y-6">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-stone-200 bg-white p-6 transition hover:border-stone-300 hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                {formatDate(post.publishedAt)} · {post.readingTimeMin} Min. Lesezeit
              </p>
              <h2 className="mt-2 text-xl font-bold text-stone-900 group-hover:text-emerald-800">
                {post.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">{post.excerpt}</p>
              <span className="mt-4 inline-block text-sm font-semibold text-emerald-700">
                Artikel lesen →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
