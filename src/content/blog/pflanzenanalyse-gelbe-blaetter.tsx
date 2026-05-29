import Link from "next/link";

export default function PflanzenanalyseGelbeBlaetter() {
  return (
    <>
      <p>
        Gelbe Blätter sind kein eindeutiges Problem. Sie können durch pH-Blockade,
        Überwässerung, Lichtstress, Stickstoffmangel, Magnesiummangel oder schlicht
        natürliche Alterung entstehen. Genau deshalb arbeitet Smokeify mit einem
        Prüfpfad: erst beobachten, dann Messwerte einordnen, dann gezielt handeln.
      </p>

      <h2>1. Symptom und Standort trennen</h2>
      <p>
        Entscheidend ist, wo die gelben Blätter auftreten. Unten an älteren
        Blättern spricht eher für mobile Nährstoffe oder normale Alterung. Oben an
        jungen Trieben ist pH, Licht oder ein akuter Versorgungsfehler wahrscheinlicher.
      </p>

      <h2>2. Messwerte vor Produktkauf prüfen</h2>
      <p>
        Bevor du Dünger erhöhst, prüfe pH, EC, Temperatur und Luftfeuchte. Viele
        scheinbare Mängel entstehen, obwohl Nährstoffe vorhanden sind, aber nicht
        aufgenommen werden. Eine Korrektur ohne Messwert kann das Problem verstärken.
      </p>

      <h2>3. Fotoanalyse sinnvoll vorbereiten</h2>
      <p>
        Für die Smokeify Pflanzenanalyse brauchst du ein scharfes Foto bei neutralem
        Licht. Ergänze Notizen zu Medium, Gießrhythmus und den letzten Änderungen.
        Die Analyse kann dadurch besser zwischen sichtbarem Symptom und Setup-Kontext
        unterscheiden.
      </p>

      <h2>4. Nur eine Stellschraube ändern</h2>
      <p>
        Wenn du gleichzeitig düngst, Licht senkst und den Gießrhythmus änderst,
        weißt du später nicht, was geholfen hat. Ändere eine Sache, dokumentiere
        sie und mache nach 24 bis 48 Stunden ein Vergleichsfoto.
      </p>

      <div className="not-prose mt-8 rounded-[28px] border border-[var(--smk-border)] bg-[rgba(255,255,255,0.04)] p-5">
        <p className="text-sm font-semibold text-[var(--smk-text)]">
          Smokeify Prüfpfad
        </p>
        <p className="mt-2 text-sm leading-6 text-[var(--smk-text-muted)]">
          Lade dein Foto hoch, ergänze Messwerte und nutze Empfehlungen als
          Checkliste statt als blinde Kaufanweisung.
        </p>
        <Link
          href="/pflanzen-analyse"
          className="smk-button-primary mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          Pflanzenanalyse starten
        </Link>
      </div>
    </>
  );
}
