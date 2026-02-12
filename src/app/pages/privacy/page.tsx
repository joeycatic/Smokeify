import PageLayout from "@/components/PageLayout";

export const DATENSCHUTZ_SECTIONS = [
  {
    title: "1. Verantwortlicher",
    paragraphs: [
      `Verantwortlicher für die Datenverarbeitung auf dieser Website ist:`,
      `Smokeify`,
      `Joey Bennett Catic`,
      `Brinkeweg 106a`,
      `33758 Schloß Holte-Stukenbrock`,
      `Deutschland`,
      `E-Mail: joey@smokeify.de`,
    ],
  },
  {
    title: "2. Datenschutzbeauftragter",
    paragraphs: [
      `Ein Datenschutzbeauftragter ist nicht benannt, da keine gesetzliche Verpflichtung besteht.`,
    ],
  },
  {
    title: "3. Allgemeine Hinweise zur Datenverarbeitung",
    paragraphs: [
      `Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Personenbezogene Daten werden vertraulich und entsprechend den gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung behandelt.`,
      `Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.`,
    ],
  },
  {
    title: "4. Hosting und Infrastruktur",
    paragraphs: [
      `Unser Online-Shop wird über den Hosting-Dienstleister Vercel betrieben.`,
      `Dabei werden personenbezogene Daten verarbeitet, die für den Betrieb, die Auslieferung und die Sicherheit der Website erforderlich sind.`,
      `Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und effizienten Betrieb).`,
    ],
  },
  {
    title: "5. Server-Logfiles",
    paragraphs: [
      `Bei jedem Aufruf der Website können Server-Logfiles verarbeitet werden (z. B. IP-Adresse, Datum/Uhrzeit, aufgerufene Seite, Referrer, Browser- und Betriebssysteminformationen).`,
      `Diese Daten sind technisch erforderlich, um die Website bereitzustellen, Fehler zu analysieren und die Sicherheit zu gewährleisten.`,
      `Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.`,
    ],
  },
  {
    title:
      "6. Erhebung und Speicherung personenbezogener Daten bei Bestellungen",
    paragraphs: [
      `Im Rahmen einer Bestellung erheben wir folgende Daten:`,
      `- Vor- und Nachname`,
      `- Rechnungs- und Lieferadresse`,
      `- E-Mail-Adresse`,
      `- Zahlungsinformationen (ausschließlich über Zahlungsdienstleister)`,
      `- Bestelldaten`,
      `Die Datenverarbeitung erfolgt zur Abwicklung der Bestellung und zur Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO.`,
      `Pflichtangaben sind für die Vertragserfüllung erforderlich. Ohne diese Daten ist eine Bestellung nicht möglich.`,
    ],
  },
  {
    title: "7. Zahlungsdienstleister",
    paragraphs: [
      `Zur Zahlungsabwicklung setzen wir externe Zahlungsdienstleister ein (z. B. Kartenzahlungen, PayPal, Klarna, Apple Pay, Google Pay).`,
      `Die Weitergabe Ihrer Zahlungsdaten erfolgt ausschließlich an den jeweiligen Zahlungsdienstleister und nur im erforderlichen Umfang.`,
      `Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.`,
      `Zahlungsdienstleister können zur Betrugsprävention automatisierte Prüfungen durchführen. In Einzelfällen kann dies zu automatisierten Entscheidungen führen.`,
    ],
  },
  {
    title: "8. Versanddienstleister",
    paragraphs: [
      `Zur Lieferung der Waren geben wir Ihren Namen und Ihre Lieferadresse an beauftragte Versanddienstleister weiter.`,
      `Die Weitergabe erfolgt gemäß Art. 6 Abs. 1 lit. b DSGVO.`,
    ],
  },
  {
    title: "9. Kontaktaufnahme",
    paragraphs: [
      `Wenn Sie uns per E-Mail oder Kontaktformular kontaktieren, werden Ihre Angaben inklusive der Kontaktdaten gespeichert, um Ihre Anfrage zu bearbeiten.`,
      `Diese Daten geben wir nicht ohne Ihre Einwilligung weiter.`,
      `Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO bei vorvertraglichen Maßnahmen oder Art. 6 Abs. 1 lit. f DSGVO bei allgemeinen Anfragen.`,
    ],
  },
  {
    title: "10. Newsletter (Resend)",
    paragraphs: [
      `Wenn Sie unseren Newsletter abonnieren, verarbeiten wir Ihre E-Mail-Adresse zum Zweck des Versands.`,
      `Die Anmeldung erfolgt im Double-Opt-In-Verfahren.`,
      `Der Versand erfolgt über den Dienst Resend.`,
      `Rechtsgrundlage ist Ihre Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.`,
      `Sie können den Newsletter jederzeit über den Abmeldelink oder per E-Mail abbestellen.`,
      `Resend ist ein Dienstanbieter mit Sitz in den USA. Es besteht eine Auftragsverarbeitung (AVV).`,
      `Die Übermittlung in Drittländer erfolgt auf Grundlage von Standardvertragsklauseln (SCC).`,
    ],
  },
  {
    title: "11. Cookies und Einwilligungen (TTDSG/ePrivacy)",
    paragraphs: [
      `Unsere Website verwendet Cookies. Cookies sind kleine Textdateien, die auf Ihrem Endgerät gespeichert werden.`,
      `Technisch notwendige Cookies werden ohne Einwilligung gesetzt (TTDSG). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO oder Art. 6 Abs. 1 lit. f DSGVO.`,
      `Sofern Tracking- oder Marketing-Cookies eingesetzt werden, erfolgt dies ausschließlich nach Ihrer ausdrücklichen Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.`,
      `Sie können Ihre Einwilligungen jederzeit über das Cookie-Banner anpassen oder widerrufen.`,
    ],
  },
  {
    title: "12. Empfänger / Kategorien von Empfängern",
    paragraphs: [
      `Je nach Verarbeitung können folgende Kategorien von Empfängern personenbezogene Daten erhalten:`,
      `- Hosting- und Infrastruktur-Dienstleister`,
      `- Zahlungsdienstleister`,
      `- Versanddienstleister`,
      `- E-Mail-Versanddienstleister (Newsletter/Transaktionsmails)`,
      `- IT- und Supportdienstleister`,
    ],
  },
  {
    title: "13. Übermittlung in Drittländer",
    paragraphs: [
      `Sofern Dienstleister in Drittländern (außerhalb der EU/des EWR) eingesetzt werden, kann eine Übermittlung personenbezogener Daten erfolgen.`,
      `Die Übermittlung erfolgt auf Grundlage von Standardvertragsklauseln (SCC) oder – sofern verfügbar – auf Grundlage des EU-US Data Privacy Framework (DPF).`,
    ],
  },
  {
    title: "14. Speicherdauer",
    paragraphs: [
      `Bestell- und Rechnungsdaten speichern wir im Rahmen gesetzlicher Aufbewahrungsfristen (regelmaessig 6 bzw. 10 Jahre).`,
      `Kontaktanfragen speichern wir in der Regel 6 bis 12 Monate, sofern keine gesetzlichen Pflichten entgegenstehen.`,
      `Newsletterdaten speichern wir bis zum Widerruf Ihrer Einwilligung.`,
    ],
  },
  {
    title: "15. Ihre Rechte",
    paragraphs: [
      `Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung sowie Datenübertragbarkeit.`,
      `Zudem haben Sie das Recht, eine erteilte Einwilligung jederzeit zu widerrufen.`,
      `Sie haben das Recht, der Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO jederzeit zu widersprechen (Art. 21 DSGVO).`,
      `Sie haben außerdem das Recht, sich bei einer Aufsichtsbehörde zu beschweren.`,
    ],
  },
  {
    title: "16. Automatisierte Entscheidungsfindung / Profiling",
    paragraphs: [
      `Eine automatisierte Entscheidungsfindung im Sinne von Art. 22 DSGVO findet nicht statt.`,
      `Zahlungsdienstleister können jedoch automatisierte Betrugsprüfungen einsetzen.`,
    ],
  },
  {
    title: "17. Datensicherheit",
    paragraphs: [
      `Wir verwenden geeignete technische und organisatorische Sicherheitsmaßnahmen, um Ihre Daten gegen Manipulation, Verlust oder unbefugten Zugriff zu schützen.`,
    ],
  },
  {
    title: "18. Änderungen dieser Datenschutzerklärung",
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
              Datenschutzerklärung
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Stand: 01.02.2026
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
