import Link from "next/link";

export default function LedGrowlampenVergleich() {
  return (
    <>
      <p>
        LED Growlampen lassen sich nicht sinnvoll nur nach Wattzahl kaufen. Für
        dein echtes Setup zählen Fläche, Lichtverteilung, Dimmbarkeit, Wärme und
        wie gut die Lampe zur Growbox passt.
      </p>

      <h2>Fläche zuerst, Leistung danach</h2>
      <p>
        Eine starke Lampe ist nur dann sinnvoll, wenn sie deine Fläche gleichmäßig
        abdeckt. Zu viel Leistung auf kleiner Fläche erzeugt Stress und Wärme,
        zu wenig Abdeckung führt zu schwachen Randbereichen.
      </p>

      <h2>Dimmbarkeit gibt Kontrolle</h2>
      <p>
        Dimmbare LEDs sind besonders nützlich, weil du Jungpflanzen, Wachstum und
        spätere Phasen besser steuern kannst. Das reduziert harte Sprünge und
        macht dein Setup fehlertoleranter.
      </p>

      <h2>Wärme bleibt ein Klimathema</h2>
      <p>
        Effiziente LEDs erzeugen trotzdem Wärme. Plane Abluft und Umluft zusammen
        mit der Lampe, damit Blattoberflächen nicht überhitzen und Luftfeuchte
        stabil bleibt.
      </p>

      <h2>Vergleichen statt raten</h2>
      <p>
        Bei ähnlichen LEDs lohnt sich ein strukturierter Blick auf Fläche,
        Hersteller, Verfügbarkeit und Rolle im Setup. So fällt die Auswahl auch
        ohne reine Watt-Fixierung deutlich sauberer aus.
      </p>

      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <Link href="/licht" className="smk-button-primary rounded-full px-5 py-2.5 text-sm font-semibold">
          Licht-Kategorie öffnen
        </Link>
        <Link href="/customizer" className="smk-button-secondary rounded-full px-5 py-2.5 text-sm font-semibold">
          Setup planen
        </Link>
      </div>
    </>
  );
}
