import InfoPageShell from "@/components/InfoPageShell";
import InfoSections from "@/components/InfoSections";

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
    <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
      <h2 className="text-xl font-semibold text-[color:var(--smk-text)]">
        Muster-Widerrufsformular
      </h2>
      <p className="mt-2 leading-relaxed text-[color:var(--smk-text-muted)]">
        (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses
        Formular aus und senden Sie es zurück.)
      </p>

      <div className="mt-4 space-y-2 text-sm leading-7 text-[color:var(--smk-text-muted)]">
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
        <p className="text-xs text-[color:var(--smk-text-dim)]">
          (*) Unzutreffendes streichen.
        </p>
      </div>
    </section>
  );
}

export default function Widerruf() {
  return (
    <InfoPageShell
      eyebrow="Widerruf"
      title="Widerruf"
      description="Hier findest du alle Informationen zum gesetzlichen Widerrufsrecht, zur Rücksendung und zum Muster-Widerrufsformular."
      meta="Stand: 01.02.2026"
    >
      <InfoSections sections={WIDERRUF_SECTIONS} />
      <div className="mt-5">
        <MusterWiderrufsformular />
      </div>
    </InfoPageShell>
  );
}
