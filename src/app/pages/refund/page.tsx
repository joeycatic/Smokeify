// Widerruf.tsx
// React / Next.js – ready to paste
// Hinweis: Bitte deine Firmendaten + Rücksendeadresse einsetzen.

import PageLayout from "@/components/PageLayout";
import React from "react";

export const WIDERRUF_SECTIONS = [
  {
    title: "Widerrufsbelehrung",
    paragraphs: [
      `Verbraucher haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.`,
    ],
  },
  {
    title: "Widerrufsfrist",
    paragraphs: [
      `Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag,`,
      `• an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die Waren in Besitz genommen haben bzw. hat, sofern Sie eine oder mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese einheitlich geliefert wird bzw. werden;`,
      `• an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die letzte Ware in Besitz genommen haben bzw. hat, sofern Sie mehrere Waren im Rahmen einer einheitlichen Bestellung bestellt haben und diese getrennt geliefert werden;`,
      `• an dem Sie oder ein von Ihnen benannter Dritter, der nicht der Beförderer ist, die letzte Teilsendung oder das letzte Stück in Besitz genommen haben bzw. hat, sofern die Lieferung einer Ware in mehreren Teilsendungen oder Stücken erfolgt.`,
    ],
  },
  {
    title: "Ausübung des Widerrufs",
    paragraphs: [
      `Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Smokeify, Joey Bennett Catic, Brinkeweg 106a, 33758 Schloß Holte-Stukenbrock, Deutschland, contact@smokeify.de) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.`,
      `Sie können dafür das unten beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.`,
      `Sie können den Widerruf auch über unser Widerrufs-/Retourenportal erklären.`,
      `Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.`,
    ],
  },
  {
    title: "Folgen des Widerrufs",
    paragraphs: [
      `Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist.`,
      `Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.`,
      `Wir können die Rückzahlung verweigern, bis wir die Waren wieder zurückerhalten haben oder bis Sie den Nachweis erbracht haben, dass Sie die Waren zurückgesandt haben, je nachdem, welches der frühere Zeitpunkt ist.`,
    ],
  },
  {
    title: "Rücksendung der Waren",
    paragraphs: [
      `Sie haben die Waren unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem Sie uns über den Widerruf dieses Vertrags unterrichten, an uns zurückzusenden oder zu übergeben.`,
      `Die Rücksendung erfolgt an: Smokeify, Joey Bennett Catic, Brinkeweg 106a, 33758 Schloß Holte-Stukenbrock, Deutschland.`,
      `Die Frist ist gewahrt, wenn Sie die Waren vor Ablauf der Frist von vierzehn Tagen absenden.`,
      `Sie tragen die unmittelbaren Kosten der Rücksendung der Waren.`,
      `Sie müssen für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.`,
    ],
  },
  {
    title: "Ausschluss bzw. vorzeitiges Erlöschen des Widerrufsrechts",
    paragraphs: [
      `Das Widerrufsrecht besteht nicht bei Verträgen`,
      `• zur Lieferung von Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch den Verbraucher maßgeblich ist oder die eindeutig auf die persönlichen Bedürfnisse des Verbrauchers zugeschnitten sind;`,
      `• zur Lieferung von Waren, die schnell verderben können oder deren Verfallsdatum schnell überschritten würde;`,
      `• zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde;`,
      `• zur Lieferung von Waren, wenn diese nach der Lieferung aufgrund ihrer Beschaffenheit untrennbar mit anderen Gütern vermischt wurden;`,
      `• zur Lieferung von Ton- oder Videoaufnahmen oder Computersoftware in einer versiegelten Packung, wenn die Versiegelung nach der Lieferung entfernt wurde;`,
      `• zur Lieferung von Zeitungen, Zeitschriften oder Illustrierten mit Ausnahme von Abonnement-Verträgen;`,
      `• zur Lieferung alkoholischer Getränke, deren Preis bei Vertragsschluss vereinbart wurde, die aber frühestens 30 Tage nach Vertragsschluss geliefert werden können und deren aktueller Wert von Schwankungen auf dem Markt abhängt, auf die der Unternehmer keinen Einfluss hat.`,
      `Das Widerrufsrecht erlischt vorzeitig bei Verträgen`,
      `• zur Lieferung versiegelter Waren, die aus Gründen des Gesundheitsschutzes oder der Hygiene nicht zur Rückgabe geeignet sind, wenn ihre Versiegelung nach der Lieferung entfernt wurde;`,
      `• zur Lieferung von digitalen Inhalten, die nicht auf einem körperlichen Datenträger geliefert werden, wenn der Verbraucher ausdrücklich zugestimmt hat, dass der Unternehmer mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist beginnt, und seine Kenntnis davon bestätigt hat, dass er durch seine Zustimmung mit Beginn der Ausführung des Vertrags sein Widerrufsrecht verliert.`,
    ],
  },
];

export function MusterWiderrufsformular() {
  return (
    <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Muster-Widerrufsformular</h2>
      <p className="mt-2 text-neutral-700 leading-relaxed">
        (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses
        Formular aus und senden Sie es zurück.)
      </p>

      <div className="mt-4 space-y-2 text-neutral-800 leading-relaxed">
        <p>An:</p>
        <p>
          Smokeify
          <br />
          Joey Bennett Catic
          <br />
          Brinkeweg 106a
          <br />
          33758 Schloß Holte-Stukenbrock
          <br />
          Deutschland
          <br />
          E-Mail: contact@smokeify.de
        </p>

        <p className="mt-4">
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen
          Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der
          folgenden Dienstleistung (*)
        </p>

        <p>Bestellt am (*) / erhalten am (*):</p>
        <p>Name des/der Verbraucher(s):</p>
        <p>Anschrift des/der Verbraucher(s):</p>
        <p>
          Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):
        </p>
        <p>Datum:</p>
        <p className="text-sm text-neutral-500">
          (*) Unzutreffendes streichen.
        </p>
      </div>
    </div>
  );
}

export default function Widerruf() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Widerruf
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Stand: 01.02.2026
            </p>
          </div>

          <div className="space-y-10">
            {WIDERRUF_SECTIONS.map((section) => (
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

          <div className="mt-10">
            <MusterWiderrufsformular />
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
