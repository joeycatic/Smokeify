import PageLayout from "@/components/PageLayout";

export const DATENSCHUTZ_SECTIONS = [
  {
    title: "1. Verantwortlicher",
    paragraphs: [
      `Verantwortlicher für die Datenverarbeitung auf dieser Website ist:`,
      `Smokeify`,
      `[Name des Betreibers / Unternehmens]`,
      `[Straße, Hausnummer]`,
      `[PLZ Ort]`,
      `Deutschland`,
      `E-Mail: [E-Mail-Adresse]`,
    ],
  },
  {
    title: "2. Allgemeine Hinweise zur Datenverarbeitung",
    paragraphs: [
      `Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Personenbezogene Daten werden vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung behandelt.`,
      `Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.`,
    ],
  },
  {
    title: "3. Hosting und Shop-System (Shopify)",
    paragraphs: [
      `Unser Online-Shop wird über Shopify betrieben. Anbieter ist Shopify International Limited, Irland.`,
      `Shopify verarbeitet personenbezogene Daten zur Bereitstellung des Online-Shops, zur Bestellabwicklung sowie zur Zahlungsabwicklung.`,
      `Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und effizienten Betrieb).`,
    ],
  },
  {
    title:
      "4. Erhebung und Speicherung personenbezogener Daten bei Bestellungen",
    paragraphs: [
      `Im Rahmen einer Bestellung erheben wir folgende Daten:`,
      `• Vor- und Nachname`,
      `• Rechnungs- und Lieferadresse`,
      `• E-Mail-Adresse`,
      `• Zahlungsinformationen (ausschließlich über Zahlungsdienstleister)`,
      `• Bestelldaten`,
      `Die Datenverarbeitung erfolgt zur Abwicklung der Bestellung und zur Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO.`,
    ],
  },
  {
    title: "5. Zahlungsdienstleister",
    paragraphs: [
      `Zur Zahlungsabwicklung setzen wir externe Zahlungsdienstleister ein (z. B. PayPal, Stripe, Klarna, Shopify Payments).`,
      `Die Weitergabe Ihrer Zahlungsdaten erfolgt ausschließlich an den jeweiligen Zahlungsdienstleister und nur im erforderlichen Umfang.`,
      `Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.`,
    ],
  },
  {
    title: "6. Versanddienstleister",
    paragraphs: [
      `Zur Lieferung der Waren geben wir Ihren Namen und Ihre Lieferadresse an beauftragte Versanddienstleister weiter.`,
      `Die Weitergabe erfolgt gemäß Art. 6 Abs. 1 lit. b DSGVO.`,
    ],
  },
  {
    title: "7. Kontaktaufnahme",
    paragraphs: [
      `Wenn Sie uns per E-Mail oder Kontaktformular kontaktieren, werden Ihre Angaben inklusive der Kontaktdaten gespeichert, um Ihre Anfrage zu bearbeiten.`,
      `Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.`,
      `Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO oder Art. 6 Abs. 1 lit. f DSGVO.`,
    ],
  },
  {
    title: "8. Newsletter (Resend)",
    paragraphs: [
      `Wenn Sie unseren Newsletter abonnieren, verarbeiten wir Ihre E-Mail-Adresse zum Zweck des Versands.`,
      `Die Anmeldung erfolgt im Double-Opt-In-Verfahren.`,
      `Der Versand erfolgt über den Dienst Resend.`,
      `Rechtsgrundlage ist Ihre Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.`,
      `Sie können den Newsletter jederzeit über den Abmeldelink oder per E-Mail abbestellen.`,
    ],
  },
  {
    title: "9. Cookies und Tracking",
    paragraphs: [
      `Unsere Website verwendet Cookies. Cookies sind kleine Textdateien, die auf Ihrem Endgerät gespeichert werden.`,
      `Technisch notwendige Cookies werden auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO eingesetzt.`,
      `Sofern Tracking- oder Marketing-Cookies eingesetzt werden, erfolgt dies ausschließlich nach Ihrer ausdrücklichen Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.`,
    ],
  },
  {
    title: "10. Speicherdauer",
    paragraphs: [
      `Wir speichern personenbezogene Daten nur so lange, wie dies zur Erfüllung der jeweiligen Zwecke erforderlich ist.`,
      `Gesetzliche Aufbewahrungsfristen bleiben unberührt.`,
    ],
  },
  {
    title: "11. Ihre Rechte",
    paragraphs: [
      `Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung sowie Datenübertragbarkeit.`,
      `Zudem haben Sie das Recht, eine erteilte Einwilligung jederzeit zu widerrufen.`,
      `Sie haben außerdem das Recht, sich bei einer Aufsichtsbehörde zu beschweren.`,
    ],
  },
  {
    title: "12. Datensicherheit",
    paragraphs: [
      `Wir verwenden geeignete technische und organisatorische Sicherheitsmaßnahmen, um Ihre Daten gegen Manipulation, Verlust oder unbefugten Zugriff zu schützen.`,
    ],
  },
  {
    title: "13. Änderungen dieser Datenschutzerklärung",
    paragraphs: [
      `Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte Rechtslagen oder bei Änderungen unseres Angebots anzupassen.`,
    ],
  },
];

export default function Datenschutz() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Datenschutzerklaerung
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Stand: {new Date().toLocaleDateString("de-DE")}
            </p>
          </div>

          <div className="space-y-10">
            {DATENSCHUTZ_SECTIONS.map((section) => (
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
