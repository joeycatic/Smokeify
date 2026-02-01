import PageLayout from "@/components/PageLayout";

export const VERSAND_ZAHLUNG_SECTIONS = [
  {
    title: "§1 Versandgebiet",
    paragraphs: [
      `Die Lieferung erfolgt innerhalb Deutschlands. Lieferungen in andere Länder erfolgen nur, sofern dies im Bestellprozess ausdrücklich angeboten wird.`,
    ],
  },
  {
    title: "§2 Versandkosten",
    paragraphs: [
      `Die anfallenden Versandkosten werden dem Kunden im Bestellprozess deutlich mitgeteilt.`,
      `Sofern nicht anders angegeben, fallen keine zusätzlichen Kosten für Verpackung oder Bearbeitung an.`,
    ],
  },
  {
    title: "§3 Lieferzeiten",
    paragraphs: [
      `Die Lieferzeit beträgt, sofern nicht beim jeweiligen Produkt anders angegeben, 2–5 Werktage innerhalb Deutschlands.`,
      `Bei Speditionsware oder Direktversand können abweichende Lieferzeiten gelten.`,
      `In der Regel erfolgt keine Zustellung an Sonn- und Feiertagen.`,
      `Kommt es zu Lieferverzögerungen, wird der Kunde unverzüglich informiert.`,
    ],
  },
  {
    title: "§4 Teillieferungen",
    paragraphs: [
      `Smokeify ist zu Teillieferungen berechtigt, sofern dies für den Kunden zumutbar ist.`,
      `Zusätzliche Versandkosten entstehen dem Kunden dadurch nicht.`,
    ],
  },
  {
    title: "§5 Zahlungsarten",
    paragraphs: [
      `Smokeify bietet die im Bestellprozess angezeigten Zahlungsarten an.`,
      `Hierzu können insbesondere gehören: PayPal, Kreditkarte, Klarna, Apple Pay, Google Pay sowie weitere über Shopify Payments angebotene Zahlungsmethoden.`,
    ],
  },
  {
    title: "§6 Zahlungsabwicklung",
    paragraphs: [
      `Die Zahlungsabwicklung erfolgt über den jeweils ausgewählten Zahlungsdienstleister.`,
      `Smokeify speichert keine vollständigen Zahlungsdaten wie Kreditkartennummern oder Kontodaten.`,
    ],
  },
  {
    title: "§7 Fälligkeit und Zahlungseingang",
    paragraphs: [
      `Der Kaufpreis ist unmittelbar mit Vertragsschluss fällig.`,
      `Der Versand der Ware erfolgt nach erfolgreicher Zahlungsautorisierung bzw. Zahlungsbestätigung, sofern nichts anderes vereinbart wurde.`,
    ],
  },
  {
    title: "§8 Rückerstattungen",
    paragraphs: [
      `Rückerstattungen erfolgen grundsätzlich über dasselbe Zahlungsmittel, das bei der ursprünglichen Transaktion verwendet wurde.`,
      `Die Rückzahlung erfolgt spätestens binnen 14 Tagen ab Zugang des Widerrufs.`,
      `Wir können die Rückzahlung verweigern, bis wir die Ware zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Ware zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist (§ 357 BGB).`,
    ],
  },
];

export default function ShippingPage() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Versand- & Zahlungsbedingungen
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Stand: 01.02.2026
            </p>
          </div>

          <div className="space-y-10">
            {VERSAND_ZAHLUNG_SECTIONS.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-xl font-semibold text-stone-900">
                  {section.title}
                </h2>
                {section.paragraphs.map((p, idx) => (
                  <p key={idx} className="leading-relaxed text-stone-700">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
