import PageLayout from "@/components/PageLayout";

export const AGB_SECTIONS = [
  {
    title: "§1 Geltungsbereich",
    paragraphs: [
      `Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen`,
      `Smokeify, contact@smokefiy.de`,
      `und den Kunden über den Online-Shop unter www.smokeify.de.`,
      `Das Angebot richtet sich ausschließlich an Verbraucher im Sinne des § 13 BGB, sofern nicht ausdrücklich anders angegeben.`,
      `Abweichende Bedingungen des Kunden werden nicht anerkannt, es sei denn, ihrer Geltung wird ausdrücklich schriftlich zugestimmt.`,
    ],
  },
  {
    title: "§2 Jugendschutz",
    paragraphs: [
      `Der Verkauf von Produkten aus den Bereichen Headshop und Growbedarf erfolgt ausschließlich an Personen ab 18 Jahren.`,
      `Mit Abgabe einer Bestellung bestätigt der Kunde, dass er das 18. Lebensjahr vollendet hat.`,
      `Smokeify behält sich vor, Altersverifikationen durchzuführen und Bestellungen bei Zweifeln abzulehnen.`,
    ],
  },
  {
    title: "§3 Vertragsabschluss",
    paragraphs: [
      `Die im Online-Shop dargestellten Produkte stellen kein rechtlich bindendes Angebot dar, sondern eine unverbindliche Aufforderung zur Bestellung.`,
      `Der Vertrag kommt zustande, sobald Smokeify die Bestellung des Kunden durch eine Bestellbestätigung per E-Mail annimmt.`,
      `Die Bestellbestätigung stellt noch keine Versandbestätigung dar.`,
    ],
  },
  {
    title: "§4 Preise und Versandkosten",
    paragraphs: [
      `Alle Preise sind Endpreise und enthalten die gesetzliche Mehrwertsteuer.`,
      `Zusätzlich zu den angegebenen Preisen können Versandkosten anfallen. Diese werden dem Kunden vor Abschluss des Bestellvorgangs klar angezeigt.`,
      `Informationen zu Versandarten, Lieferzeiten und Kosten sind unter „Versand & Zahlung“ einsehbar.`,
    ],
  },
  {
    title: "§5 Lieferung",
    paragraphs: [
      `Die Lieferung erfolgt an die vom Kunden angegebene Lieferadresse.`,
      `Lieferzeiten sind abhängig vom Produkt und werden im Shop angegeben.`,
      `Sollte ein Produkt nicht verfügbar sein, wird der Kunde unverzüglich informiert.`,
    ],
  },
  {
    title: "§6 Zahlungsarten",
    paragraphs: [
      `Smokeify bietet die im Shop angegebenen Zahlungsarten an (z. B. PayPal, Kreditkarte, Klarna, Shopify Payments).`,
      `Die Belastung erfolgt unmittelbar nach Vertragsabschluss, sofern nichts anderes vereinbart ist.`,
    ],
  },
  {
    title: "§7 Eigentumsvorbehalt",
    paragraphs: [
      `Die gelieferte Ware bleibt bis zur vollständigen Bezahlung Eigentum von Smokeify.`,
    ],
  },
  {
    title: "§8 Widerrufsrecht",
    paragraphs: [
      `Verbrauchern steht ein gesetzliches Widerrufsrecht zu.`,
      `Die Widerrufsbelehrung sowie das Muster-Widerrufsformular sind unter „Widerruf“ im Online-Shop abrufbar.`,
    ],
  },
  {
    title: "§9 Gewährleistung",
    paragraphs: [
      `Es gelten die gesetzlichen Gewährleistungsrechte.`,
      `Offensichtliche Transportschäden sind möglichst umgehend beim Zusteller zu reklamieren und Smokeify mitzuteilen. Die gesetzlichen Rechte des Kunden bleiben hiervon unberührt.`,
    ],
  },
  {
    title: "§10 Haftung",
    paragraphs: [
      `Smokeify haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit.`,
      `Bei leichter Fahrlässigkeit haftet Smokeify nur bei Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) und begrenzt auf den vorhersehbaren, typischerweise eintretenden Schaden.`,
      `Die Haftung für Schäden an Leben, Körper oder Gesundheit bleibt unberührt.`,
    ],
  },
  {
    title: "§11 Nutzung der Produkte / Haftungsausschluss",
    paragraphs: [
      `Die angebotenen Produkte dienen ausschließlich legalen Zwecken.`,
      `Smokeify übernimmt keine Haftung für eine unsachgemäße, missbräuchliche oder rechtswidrige Nutzung der Produkte.`,
      `Die Produkte sind kein Spielzeug und außerhalb der Reichweite von Kindern aufzubewahren.`,
    ],
  },
  {
    title: "§12 Marken- und Urheberrechte",
    paragraphs: [
      `Alle im Shop genannten Marken, Logos und Produktbezeichnungen sind Eigentum der jeweiligen Rechteinhaber.`,
    ],
  },
  {
    title: "§13 Datenschutz",
    paragraphs: [
      `Informationen zur Verarbeitung personenbezogener Daten finden sich in der Datenschutzerklärung.`,
    ],
  },
  {
    title: "§14 Online-Streitbeilegung / Verbraucherstreitbeilegung",
    paragraphs: [
      `Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit.`,
      `Smokeify ist nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.`,
    ],
  },
  {
    title: "§15 Schlussbestimmungen",
    paragraphs: [
      `Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.`,
      `Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.`,
    ],
  },
];

export default function AgbPage() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Allgemeine Geschäftsbedingungen
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Stand: {new Date().toLocaleDateString("de-DE")}
            </p>
          </div>

          <div className="grid gap-6 border-b border-black/10 pb-6 md:grid-cols-2">
            <div className="space-y-1 text-sm text-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Anbieter
              </p>
              <p className="font-semibold text-stone-900">Smokeify</p>
            </div>
            <div className="space-y-1 text-sm text-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Kontakt
              </p>
              <div className="flex flex-col items-start gap-1">
                <a
                  href="mailto:contact@smokeify.de"
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  contact@smokeify.de
                </a>
                <a
                  href="https://www.smokeify.de"
                  className="text-stone-600 hover:text-stone-700"
                >
                  www.smokeify.de
                </a>
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-10">
            {AGB_SECTIONS.map((section) => (
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
