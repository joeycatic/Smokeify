import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";
import { getProducts } from "@/lib/catalog";
import { seoPageBySlug, seoPages, type SeoPageConfig } from "@/lib/seoPages";
import SeoProductsClient from "./SeoProductsClient";

type PageProps = {
  params: Promise<{ slug: string[] }>;
};

const getConfig = (slugParts: string[]) => {
  return seoPageBySlug.get(slugParts.join("/")) ?? null;
};

const matchesCategory = (
  config: SeoPageConfig,
  handle: string,
  parent?: string,
) => {
  const normalizedHandle = handle.toLowerCase();
  const normalizedParent = parent?.toLowerCase() ?? null;
  if (config.subcategoryHandle) {
    const directMatch = normalizedHandle === config.subcategoryHandle;
    const prefixedMatch =
      config.parentHandle &&
      normalizedHandle === `${config.parentHandle}-${config.subcategoryHandle}`;
    const singularPrefixedMatch =
      config.parentHandle &&
      config.parentHandle.endsWith("en") &&
      normalizedHandle ===
        `${config.parentHandle.slice(0, -2)}-${config.subcategoryHandle}`;
    if (!directMatch && !prefixedMatch && !singularPrefixedMatch) return false;
    if (config.parentHandle) {
      return normalizedParent === config.parentHandle;
    }
    return true;
  }
  if (!config.categoryHandle) return false;
  if (normalizedHandle === config.categoryHandle) return true;
  return normalizedParent === config.categoryHandle;
};

const sizeKeyFrom = (value?: string | null) => {
  if (!value) return null;
  const matches = value.match(/(\d+(?:[.,]\d+)?)/g);
  if (!matches || matches.length < 2) return null;
  const numbers = matches
    .map((match) => Number(match.replace(",", ".")))
    .filter((num) => Number.isFinite(num));
  if (numbers.length < 2) return null;
  return `${numbers[0]}x${numbers[1]}`;
};

const buildDefaultFaq = (title: string) => [
  {
    question: `Worauf sollte ich bei ${title} achten?`,
    answer:
      "Achte auf Qualität, passende Größe/Leistung und eine saubere Verarbeitung. So stellst du sicher, dass das Produkt zuverlässig zu deinem Setup passt.",
  },
  {
    question: `Gibt es Empfehlungen für den Einstieg in ${title}?`,
    answer:
      "Starte mit bewährten Basics und erweitere nach Bedarf. Bei Fragen helfen dir Produktdetails und Bewertungen bei der Auswahl.",
  },
];

const filterProductsForConfig = (config: SeoPageConfig) => {
  return (product: Awaited<ReturnType<typeof getProducts>>[number]) => {
    const matchesCategoryFilter =
      product.categories?.some((category) =>
        matchesCategory(
          config,
          category.handle,
          category.parent?.handle ?? undefined,
        ),
      ) ?? false;
    if (!matchesCategoryFilter) return false;
    if (config.growboxSize) {
      return sizeKeyFrom(product.growboxSize) === config.growboxSize;
    }
    return true;
  };
};

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ??
  "https://www.smokeify.de";
const toUrl = (path: string) => `${siteUrl}${path}`;

export async function generateStaticParams() {
  return seoPages.map((page) => ({ slug: page.slugParts }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const config = getConfig(slug);
  if (!config) return {};
  const path = `/${config.slugParts.join("/")}`;
  const title = `${config.title} | Smokeify`;
  return {
    title,
    description: config.description,
    alternates: {
      canonical: path,
      languages: {
        "de-DE": path,
        "x-default": path,
      },
    },
    openGraph: {
      type: "website",
      url: toUrl(path),
      title,
      description: config.description,
      images: [{ url: toUrl("/favicons/apple-touch-icon.png"), alt: config.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: config.description,
      images: [toUrl("/favicons/apple-touch-icon.png")],
    },
  };
}

export default async function SeoCategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const config = getConfig(slug);
  if (!config) return notFound();

  const products = await getProducts(500);
  const filtered = products.filter(filterProductsForConfig(config));
  const itemList = filtered.slice(0, 20).map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: toUrl(`/products/${product.handle}`),
    name: product.title,
    image: product.featuredImage?.url ?? undefined,
  }));
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: itemList,
  };
  const breadcrumbs = [{ name: "Startseite", url: toUrl("/") }] as Array<{
    name: string;
    url: string;
  }>;
  if (config.parentHandle) {
    const parentSlug = `/${config.parentHandle}`;
    const parentTitle =
      seoPageBySlug.get(config.parentHandle)?.title ?? config.parentHandle;
    breadcrumbs.push({ name: parentTitle, url: toUrl(parentSlug) });
  } else if (config.growboxSize) {
    breadcrumbs.push({ name: "Growboxen", url: toUrl("/growboxen") });
  }
  breadcrumbs.push({
    name: config.title,
    url: toUrl(`/${config.slugParts.join("/")}`),
  });
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
  const faqSchema =
    (config.faq && config.faq.length > 0 ? config.faq : buildDefaultFaq(config.title))
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: (config.faq && config.faq.length > 0
            ? config.faq
            : buildDefaultFaq(config.title)
          ).map((entry) => ({
            "@type": "Question",
            name: entry.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: entry.answer,
            },
          })),
        }
      : null;
  const growboxSizes = [
    "60x60",
    "80x80",
    "100x100",
    "120x120",
    "150x150",
    "200x200",
  ];
  const showGrowboxSizeLinks =
    config.categoryHandle === "growboxen" || config.growboxSize;
  const sizeLinks = showGrowboxSizeLinks
    ? [
        {
          label: "Alle Größen",
          href: "/growboxen",
          active: !config.growboxSize,
        },
        ...growboxSizes.map((size) => ({
          label: size,
          href: `/growboxen-${size}`,
          active: config.growboxSize === size,
        })),
      ]
    : [];

  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-6">
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-2 text-xs text-stone-500"
        >
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.url} className="flex items-center gap-2">
              <Link
                href={crumb.url.replace(siteUrl, "")}
                className="hover:text-stone-700"
              >
                {crumb.name}
              </Link>
              {index < breadcrumbs.length - 1 && <span>/</span>}
            </span>
          ))}
        </nav>
        <section className="mt-2">
          <SeoProductsClient
            initialProducts={filtered}
            title={config.title}
            subtitle={config.description}
            copy={config.copy}
            faq={config.faq && config.faq.length > 0 ? config.faq : buildDefaultFaq(config.title)}
            sizeLinks={sizeLinks}
          />
        </section>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
        {faqSchema ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
          />
        ) : null}
      </main>
    </PageLayout>
  );
}
