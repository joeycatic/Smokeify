import InfoPageShell from "@/components/InfoPageShell";
import InfoSections from "@/components/InfoSections";
import { businessDetails } from "@/lib/businessDetails";

export const AGB_SECTIONS = [
  {
    title: "§1 Geltungsbereich",
    paragraphs: [
      `Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen`,
      `Smokeify, contact@smokeify.de`,
      `und den Kunden über den Online-Shop unter www.smokeify.de.`,
      `Das Angebot richtet sich ausschließlich an Verbraucher im Sinne des § 13 BGB, sofern nicht ausdrücklich anders angegeben.`,
      `Abweichende Bedingungen des Kunden werden nicht anerkannt, es sei denn, ihrer Geltung wird ausdrücklich schriftlich zugestimmt.`,
    ],
  },
  {
    title: "§2 Produktauswahl und zulässige Nutzung",
    paragraphs: [
      `Smokeify verkauft ausschließlich legale Produkte und Zubehörartikel innerhalb des jeweils angebotenen Sortiments.`,
      `Eine Nutzung der angebotenen Produkte hat ausschließlich im Rahmen der geltenden gesetzlichen Vorschriften und Herstellerhinweise zu erfolgen.`,
      `Smokeify behält sich vor, Bestellungen abzulehnen, wenn ein begründeter Verdacht auf eine rechtswidrige oder missbräuchliche Verwendung besteht.`,
    ],
  },
  {
    title: "§3 Vertragsabschluss",
    paragraphs: [
      `Die im Online-Shop dargestellten Produkte stellen kein rechtlich bindendes Angebot dar, sondern eine unverbindliche Aufforderung zur Bestellung.`,
      `Der Vertrag kommt zustande, sobald Smokeify die Bestellung des Kunden durch eine Bestellbestätigung per E-Mail annimmt.`,
      `Die Bestellbestätigung stellt noch keine Versandbestätigung dar.`,
      `Bei offensichtlichen Preisirrtümern sowie Schreib- und Rechenfehlern behält sich Smokeify vor, Bestellungen abzulehnen oder den Vertrag anzufechten und zu stornieren.`,
      `Vertragssprache ist Deutsch.`,
      `Der Vertragstext wird von Smokeify gespeichert und dem Kunden nach Vertragsschluss per E-Mail (Bestellbestätigung) übermittelt.`,
    ],
  },
  {
    title: "§4 Preise und Versandkosten",
    paragraphs: [
      `Alle Preise sind Endpreise. Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen.`,
      `Zusätzlich zu den angegebenen Preisen können Versandkosten anfallen. Diese werden dem Kunden vor Abschluss des Bestellvorgangs klar angezeigt.`,
      `Informationen zu Versandarten, Lieferzeiten und Kosten sind unter „Versand & Zahlung“ einsehbar.`,
    ],
  },
  {
    title: "§5 Lieferung",
    paragraphs: [
      `Die Lieferung erfolgt EU-weit sowie in weitere im Bestellprozess auswählbare Lieferländer.`,
      `Die Lieferung erfolgt an die vom Kunden angegebene Lieferadresse.`,
      `Lieferzeiten sind abhängig vom Produkt und werden im Shop angegeben.`,
      `Sollte ein Produkt nicht verfügbar sein, wird der Kunde unverzüglich informiert.`,
      `Ist eine Teillieferung zumutbar, kann diese erfolgen. Eventuelle Mehrkosten entstehen dem Kunden hierdurch nicht.`,
      `Im Falle der Nichtverfügbarkeit kann der Kunde vom Vertrag zurücktreten; bereits geleistete Zahlungen werden unverzüglich erstattet.`,
    ],
  },
  {
    title: "§6 Zahlungsarten",
    paragraphs: [
      `Smokeify bietet die im Shop angegebenen Zahlungsarten an (z. B. Kartenzahlung, PayPal, Klarna, Apple Pay, Google Pay).`,
      `Die Belastung erfolgt abhängig von der gewählten Zahlungsart. Weitere Informationen sind im Bestellprozess ersichtlich.`,
      `Gerät der Kunde in Verzug, gelten die gesetzlichen Verzugsregelungen.`,
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
      `Smokeify übernimmt keine Haftung für eine unsachgemäße, missbräuchliche oder rechtswidrige Nutzung der Produkte, soweit gesetzlich zulässig.`,
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
      `Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: https://ec.europa.eu/consumers/odr`,
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
  const {
    cityPostalLine,
    companyName,
    contactEmail,
    contactPhone,
    country,
    legalName,
    streetLine,
    vatId,
    websiteLabel,
    websiteUrl,
  } = businessDetails;

  return (
    <InfoPageShell
      eyebrow="Rechtliches"
      title="Allgemeine Geschäftsbedingungen"
      description="Die AGB regeln Vertragsabschluss, Lieferung, Zahlung, Gewährleistung und weitere rechtliche Grundlagen unseres Shops."
      meta="Stand: 11.02.2026"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <section className="smk-surface rounded-[28px] px-5 py-5">
          <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent)]">
            Anbieter
          </p>
          <div className="mt-4 space-y-1 text-sm leading-7 text-[color:var(--smk-text-muted)]">
            <p className="font-semibold text-[color:var(--smk-text)]">
              {companyName}
            </p>
            <p>{legalName}</p>
            <p>{streetLine}</p>
            <p>{cityPostalLine}</p>
            <p>{country}</p>
            {vatId ? <p>USt-IdNr.: {vatId}</p> : null}
          </div>
        </section>
        <section className="smk-surface rounded-[28px] px-5 py-5">
          <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent)]">
            Kontakt
          </p>
          <div className="mt-4 flex flex-col items-start gap-1 text-sm leading-7 text-[color:var(--smk-text-muted)]">
            <a
              href={`mailto:${contactEmail}`}
              className="font-semibold text-[color:var(--smk-text)] transition hover:text-[color:var(--smk-accent)]"
            >
              {contactEmail}
            </a>
            {contactPhone ? <span>{contactPhone}</span> : null}
            <a
              href={websiteUrl}
              className="transition hover:text-[color:var(--smk-text)]"
            >
              {websiteLabel}
            </a>
          </div>
        </section>
      </div>
      <div className="mt-5">
        <InfoSections sections={AGB_SECTIONS} />
      </div>
    </InfoPageShell>
  );
}
