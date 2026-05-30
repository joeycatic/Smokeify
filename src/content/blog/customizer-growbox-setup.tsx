import Link from "next/link";

export default function CustomizerGrowboxSetup() {
  return (
    <>
      <p>
        Der Smokeify Konfigurator ist für Setups gedacht, bei denen Zelt, Licht,
        Abluft und Zubehör zusammen entschieden werden müssen. So vermeidest du,
        dass ein einzelnes gutes Produkt im Gesamtaufbau nicht passt.
      </p>

      <h2>Beginne mit der Growbox</h2>
      <p>
        Die Box bestimmt Fläche, Höhe, Anschlussdurchmesser und spätere Reserven.
        Erst danach lassen sich Licht und Abluft sinnvoll eingrenzen.
      </p>

      <h2>Licht muss zur Fläche passen</h2>
      <p>
        Der Konfigurator filtert Lichtoptionen gegen die ausgewählte Box. Das
        verhindert, dass du zu klein planst oder eine Lampe wählst, die unnötig
        viel Wärme und Intensität erzeugt.
      </p>

      <h2>Abluft ist der Stabilitätsanker</h2>
      <p>
        Abluft entscheidet über Temperatur, Luftfeuchte und Geruchskontrolle. Ein
        passender Anschlussdurchmesser reduziert Adapter und macht den Aufbau
        wartbarer.
      </p>

      <h2>Extras bewusst auswählen</h2>
      <p>
        Bewässerung und Anzucht-Zubehör sind hilfreich, aber optional. Wähle sie
        erst dazu, wenn das Kernsetup steht und du weißt, welche Routine du
        wirklich brauchst.
      </p>

      <div className="not-prose mt-8 rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-5">
        <p className="text-sm font-semibold text-[var(--smk-text)]">
          Direkt ausprobieren
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
          Der Konfigurator verändert keine Checkout-Logik. Preise und Bestand
          bleiben im Warenkorb serverseitig autoritativ.
        </p>
        <Link
          href="/customizer"
          className="smk-button-primary mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Konfigurator öffnen
        </Link>
      </div>
    </>
  );
}
