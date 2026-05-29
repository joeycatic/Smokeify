import Link from "next/link";

export default function AbluftSetupGuide() {
  return (
    <>
      <p>
        Abluft entscheidet darüber, ob dein Setup stabil, leise und alltagstauglich
        bleibt. Ein Lüfter allein reicht nicht: Filter, Schlauch, Durchmesser,
        Luftweg und gewünschte Lautstärke müssen zusammenpassen.
      </p>

      <h2>Warum Reserve wichtiger ist als Maximalleistung</h2>
      <p>
        Ein Lüfter, der dauerhaft am Limit läuft, wird lauter und hat weniger
        Spielraum bei Wärme oder Filterwiderstand. Etwas Reserve ist deshalb oft
        leiser und stabiler als die rechnerisch kleinste Lösung.
      </p>

      <h2>Durchmesser sauber planen</h2>
      <p>
        Filter, Lüfter und Schlauch sollten denselben Anschlussdurchmesser nutzen.
        Adapter funktionieren, erhöhen aber Widerstand und Komplexität. Wenn dein
        Zelt mehrere Öffnungen bietet, plane direkt mit der sinnvollsten Größe.
      </p>

      <h2>Geruchskontrolle hängt am Filter</h2>
      <p>
        Ein Aktivkohlefilter sollte zur Luftleistung passen. Zu viel Durchsatz durch
        einen zu kleinen Filter kann Geruchskontrolle verschlechtern. Zu wenig
        Durchsatz kann Klima und Feuchte instabil machen.
      </p>

      <h2>Smokeify Kaufpfad</h2>
      <p>
        Wenn du unsicher bist, vergleiche Luft-Sets statt nur Einzelteile. Sets
        reduzieren Fehlkäufe, Einzelteile geben dir mehr Kontrolle bei Lautstärke
        und Ausbaugrad.
      </p>

      <div className="not-prose mt-8 flex flex-wrap gap-3">
        <Link href="/luft" className="smk-button-primary rounded-full px-5 py-2.5 text-sm font-semibold">
          Luft-Kategorie öffnen
        </Link>
        <Link href="/products/compare" className="smk-button-secondary rounded-full px-5 py-2.5 text-sm font-semibold">
          Produkte vergleichen
        </Link>
      </div>
    </>
  );
}
