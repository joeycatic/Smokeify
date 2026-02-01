import PageLayout from "@/components/PageLayout";

export const RETURN_POLICY_SECTIONS = [
  {
    title: "1. Allgemeines",
    paragraphs: [
      `Diese Rückgabe- und Retourenrichtlinie ergänzt das gesetzliche Widerrufsrecht.`,
      `Die gesetzlichen Rechte der Verbraucher, insbesondere das Widerrufsrecht, bleiben hiervon unberührt.`,
    ],
  },
  {
    title: "2. Rückgabefrist",
    paragraphs: [
      `Sie können Artikel innerhalb von 14 Tagen nach Erhalt der Ware im Rahmen Ihres gesetzlichen Widerrufsrechts an uns zurücksenden.`,
      `Die Rücksendung muss innerhalb dieser Frist an uns abgesendet werden.`,
    ],
  },
  {
    title: "3. Voraussetzungen für eine Rückgabe",
    paragraphs: [
      `Die Ware muss unbenutzt, unbeschädigt und möglichst in der Originalverpackung zurückgesendet werden.`,
      `Bitte vermeiden Sie Beschädigungen und Verunreinigungen der Ware.`,
      `Ein Wertverlust kann geltend gemacht werden, wenn dieser auf einen nicht notwendigen Umgang zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Ware zurückzuführen ist.`,
    ],
  },
  {
    title: "4. Vom Umtausch ausgeschlossene Artikel",
    paragraphs: [
      `Das Widerrufsrecht erlischt bei versiegelten Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde (§ 312g Abs. 2 Nr. 3 BGB).`,
      `Hierzu zählen insbesondere hygienisch versiegelte Produkte oder Verbrauchsartikel (z. B. Filtertips, Papers, Mundstücke, Grinder-Zubehör) nach Entfernung des Siegels.`,
      `Die gesetzlichen Ausnahmen vom Widerrufsrecht bleiben unberührt.`,
    ],
  },
  {
    title: "5. Rücksendeprozess",
    paragraphs: [
      `Bitte beantragen Sie Retouren bevorzugt über unser Retourenportal oder per E-Mail. Der Widerruf ist formfrei und kann auch auf anderem Weg erklärt werden.`,
      `Nach Eingang Ihrer Anfrage erhalten Sie weitere Informationen zur Rücksendung.`,
      `Unfreie Sendungen werden bei Widerruf/Retouren nicht angenommen. Bei mängelbedingten Rücksendungen stellen wir ein Retourenlabel oder erstatten die Versandkosten.`,
    ],
  },
  {
    title: "6. Kosten der Rücksendung",
    paragraphs: [
      `Die unmittelbaren Kosten der Rücksendung tragen Sie als Kunde, sofern nichts anderes vereinbart wurde.`,
    ],
  },
  {
    title: "7. Erstattung",
    paragraphs: [
      `Nach Eingang und Prüfung der retournierten Ware erstatten wir Ihnen den Kaufbetrag.`,
      `Die Rückerstattung erfolgt über dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion verwendet haben.`,
      `Die Rückzahlung erfolgt spätestens binnen 14 Tagen ab Zugang Ihres Widerrufs.`,
      `Wir können die Rückzahlung verweigern, bis wir die Ware zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Ware zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist (§ 357 BGB).`,
    ],
  },
  {
    title: "8. Beschädigte oder fehlerhafte Artikel",
    paragraphs: [
      `Sollte ein Artikel beschädigt oder fehlerhaft bei Ihnen ankommen, kontaktieren Sie uns bitte umgehend.`,
      `In diesem Fall übernehmen wir selbstverständlich die Kosten der Rücksendung.`,
    ],
  },
];

export default function ReturnPolicy() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Rückgabe & Retouren
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Stand: 01.02.2026
            </p>
          </div>

          <div className="space-y-10">
            {RETURN_POLICY_SECTIONS.map((section) => (
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
