import type { Metadata } from "next";
import Link from "next/link";

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
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-stone-900">
            Smokeify
          </span>
          <Link
            href="/pages/contact"
            className="inline-flex items-center justify-center rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Beratung anfragen
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10 pt-12 sm:pb-16 sm:pt-16">
        <div className="rounded-3xl bg-white p-8 shadow-[0_25px_60px_rgba(15,23,42,0.12)] sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Pflanzenpflege zuhause
              </p>
              <h1 className="text-3xl font-semibold text-stone-900 sm:text-4xl">
                Licht, Luft und Pflegezubehör für gesunde Zimmerpflanzen.
              </h1>
              <p className="text-base text-stone-600 sm:text-lg">
                Finden Sie passende LED-Beleuchtung, leise Luftzirkulation und
                praktische Helfer für die tägliche Pflanzenpflege.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/pages/contact"
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Persönliche Beratung
                </Link>
                <Link
                  href="/pages/shipping"
                  className="inline-flex items-center justify-center rounded-xl border border-stone-300 px-6 py-3 text-base font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  Versand & Zahlung
                </Link>
              </div>
              <div className="flex flex-wrap gap-6 text-sm text-stone-600">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  LED-Lichtsysteme
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Luftzirkulation
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  Pflege-Zubehör
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-stone-50 p-6">
              <div className="space-y-5 text-sm text-stone-700">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                    Warum Smokeify
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-stone-900">
                    Klar beraten. Schnell geliefert.
                  </h2>
                </div>
                <ul className="space-y-4">
                  <li className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                    Passende Lichtstärken für unterschiedliche Pflanzen.
                  </li>
                  <li className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                    Leise Lösungen für angenehmes Raumklima.
                  </li>
                  <li className="rounded-xl border border-stone-200 bg-white px-4 py-3">
                    Praktisches Zubehör für die tägliche Pflege.
                  </li>
                </ul>
                <p className="text-xs text-stone-500">
                  Fragen? Unser Team unterstützt Sie gerne bei der Auswahl.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-14">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "LED-Beleuchtung",
              copy: "Effiziente Lichtlösungen für unterschiedliche Räume.",
            },
            {
              title: "Raumluft & Klima",
              copy: "Leise Luftzirkulation für frische, angenehme Räume.",
            },
            {
              title: "Pflege-Zubehör",
              copy: "Tools und Helfer für die tägliche Pflanzenpflege.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold text-stone-900">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-stone-600">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-stone-200 bg-white p-8 shadow-sm sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900">
              Sie brauchen eine Empfehlung?
            </h2>
            <p className="mt-2 text-sm text-stone-600">
              Wir helfen Ihnen, die passenden Produkte für Ihre Pflanzen zu
              finden.
            </p>
          </div>
          <Link
            href="/pages/contact"
            className="inline-flex items-center justify-center rounded-xl bg-stone-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Kontakt aufnehmen
          </Link>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Smokeify</span>
          <div className="flex flex-wrap gap-4 text-xs">
            <Link className="hover:text-stone-900" href="/pages/imprint">
              Impressum
            </Link>
            <Link className="hover:text-stone-900" href="/pages/privacy">
              Datenschutz
            </Link>
            <Link className="hover:text-stone-900" href="/pages/contact">
              Kontakt
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
