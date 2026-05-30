import InfoPageShell from "@/components/InfoPageShell";
import InfoSections from "@/components/InfoSections";
import {
  FREE_SHIPPING_THRESHOLD_EUR,
  SHIPPING_BASE,
  SHIPPING_COUNTRY_LABELS,
} from "@/lib/shippingPolicy";

export const VERSAND_ZAHLUNG_SECTIONS = [
  {
    title: "§1 Versandgebiet",
    paragraphs: [
      `Die Lieferung erfolgt EU-weit. Lieferungen in weitere Länder erfolgen nur, sofern dies im Bestellprozess ausdrücklich angeboten wird.`,
    ],
  },
  {
    title: "§2 Versandkosten",
    paragraphs: [
      `Die anfallenden Versandkosten werden dem Kunden im Bestellprozess deutlich mitgeteilt.`,
      `Sofern nicht anders angegeben, fallen keine zusätzlichen Kosten für Verpackung oder Bearbeitung an.`,
      `Ab einem Bestellwert von ${FREE_SHIPPING_THRESHOLD_EUR.toFixed(2)} EUR liefern wir versandkostenfrei.`,
    ],
  },
  {
    title: "§3 Lieferzeiten",
    paragraphs: [
      `Die Lieferzeit beträgt, sofern nicht beim jeweiligen Produkt anders angegeben, in der Regel 2-5 Werktage innerhalb Deutschlands und 3-7 Werktage innerhalb der EU (abhängig vom Zielland).`,
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
      `Die im Shop dargestellten Zahlungslogos dienen der Orientierung; verbindlich und maßgeblich sind ausschließlich die im Checkout konkret auswählbaren Zahlungsarten.`,
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
    <InfoPageShell
      eyebrow="Versand"
      title="Versand- & Zahlungsbedingungen"
      description="Alle Informationen zu Liefergebiet, Versandkosten, Zahlungsarten und Rückerstattungen."
      meta="Stand: 01.02.2026"
    >
      <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
        <h2 className="text-xl font-semibold text-[color:var(--smk-text)]">
          Aktuelle Versandkosten
        </h2>
        <div className="mt-4 overflow-hidden rounded-[22px] border border-[color:var(--smk-border)]">
          <table className="w-full border-collapse text-left text-sm text-[color:var(--smk-text-muted)]">
            <thead className="bg-[color:var(--smk-panel)] text-[color:var(--smk-text)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Zielland</th>
                <th className="px-4 py-3 font-semibold">Versandkosten</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SHIPPING_BASE).map(([country, amount]) => (
                <tr
                  key={country}
                  className="border-t border-[color:var(--smk-border)]"
                >
                  <td className="px-4 py-3">
                    {
                      SHIPPING_COUNTRY_LABELS[
                        country as keyof typeof SHIPPING_COUNTRY_LABELS
                      ]
                    }
                  </td>
                  <td className="px-4 py-3">{amount.toFixed(2)} EUR</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="mt-5">
        <InfoSections sections={VERSAND_ZAHLUNG_SECTIONS} />
      </div>
    </InfoPageShell>
  );
}
