import InfoPageShell from "@/components/InfoPageShell";

const GUIDELINES = [
  "Der Schutz von Kindern und Jugendlichen ist uns wichtig.",
  "Aktuell verkaufen wir über diesen Shop keine Produkte, die ausschließlich an volljährige Personen abgegeben werden dürfen.",
  "Sollte sich das Sortiment in Zukunft ändern, werden rechtliche Hinweise und etwaige Schutzmaßnahmen transparent auf den betroffenen Produktseiten und im Checkout ausgewiesen.",
  "Unabhängig davon sind alle angebotenen Produkte entsprechend der gesetzlichen Vorgaben und Herstellerhinweise zu verwenden und außerhalb der Reichweite von Kindern aufzubewahren.",
];

export default function JugendschutzhinweisePage() {
  return (
    <InfoPageShell
      eyebrow="Jugendschutz"
      title="Jugendschutzhinweise"
      description="Informationen zum Schutz Minderjähriger und zum aktuellen Sortiment von Smokeify."
    >
      <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
        <div className="space-y-3 text-sm leading-7 text-[color:var(--smk-text-muted)]">
          {GUIDELINES.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </section>
    </InfoPageShell>
  );
}
