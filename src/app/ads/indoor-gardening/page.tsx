import type { Metadata } from "next";
import Link from "next/link";
import PageLayout from "@/components/PageLayout";

export const metadata: Metadata = {
  title: "Pflanzenpflege & Beleuchtung",
  description:
    "LED-Lichtlösungen, Luftzirkulation und Pflege-Zubehör für gesunde Pflanzen zuhause.",
  alternates: {
    canonical: "/ads/indoor-gardening",
  },
  openGraph: {
    title: "Pflanzenpflege & Beleuchtung | Smokeify",
    description:
      "LED-Lichtlösungen, Luftzirkulation und Pflege-Zubehör für gesunde Pflanzen zuhause.",
  },
  twitter: {
    title: "Pflanzenpflege & Beleuchtung | Smokeify",
    description:
      "LED-Lichtlösungen, Luftzirkulation und Pflege-Zubehör für gesunde Pflanzen zuhause.",
  },
};

export default function IndoorGardeningAdsPage() {
  return (
    <PageLayout commerce>
      <div className="space-y-6 text-[var(--smk-text)]">
        <section className="rounded-[42px] border border-[var(--smk-border)] bg-[radial-gradient(circle_at_14%_16%,rgba(241,198,132,0.18),transparent_30%),linear-gradient(135deg,rgba(23,20,17,0.99),rgba(12,11,10,1))] px-6 py-10 shadow-[0_32px_90px_rgba(0,0,0,0.36)] sm:px-10">
          <p className="smk-kicker">Smokeify Pflanzenpflege</p>
          <h1 className="smk-heading mt-4 max-w-4xl text-5xl leading-[0.95] text-[var(--smk-text)] sm:text-6xl">
            Licht, Luft und Pflegezubehör für stabile Zimmerpflanzen.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
            Kuratierte LED-Beleuchtung, leise Luftzirkulation und praktische
            Pflegehelfer. Smokeify führt dich vom ersten Bedarf direkt zu
            passenden Produkten oder zum Kontakt.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/products" className="smk-button-primary rounded-full px-5 py-3 text-sm font-semibold">
              Produkte entdecken
            </Link>
            <Link href="/pages/contact" className="smk-button-secondary rounded-full px-5 py-3 text-sm font-semibold">
              Beratung anfragen
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "LED-Beleuchtung",
              copy: "Effiziente Lichtlösungen für unterschiedliche Räume und Pflanzen.",
              href: "/licht",
            },
            {
              title: "Raumluft & Klima",
              copy: "Leise Luftbewegung und bessere Kontrolle über Hitze und Feuchte.",
              href: "/luft",
            },
            {
              title: "Pflege-Zubehör",
              copy: "Tools und Helfer, mit denen Routine weniger zufällig wird.",
              href: "/products",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group smk-surface rounded-[28px] p-6 transition hover:-translate-y-0.5 hover:border-[var(--smk-border-strong)]"
            >
              <h2 className="text-xl font-semibold tracking-[-0.04em] text-[var(--smk-text)] group-hover:text-[var(--smk-accent)]">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
                {item.copy}
              </p>
            </Link>
          ))}
        </section>

        <section className="smk-panel rounded-[34px] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="smk-kicker">Empfehlung statt Raten</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[var(--smk-text)]">
                Du brauchst eine schnelle Auswahl?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)]">
                Starte im Katalog, arbeite dich über die Kategorien vor oder
                frag direkt bei Smokeify an.
              </p>
            </div>
            <Link href="/pages/contact" className="smk-button-primary rounded-full px-6 py-3 text-sm font-semibold">
              Kontakt aufnehmen
            </Link>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
