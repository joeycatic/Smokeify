import PageLayout from "@/components/PageLayout";

const GUIDELINES = [
  "Der Schutz von Kindern und Jugendlichen ist uns wichtig.",
  "Aktuell verkaufen wir über diesen Shop keine Produkte, die ausschließlich an volljährige Personen abgegeben werden dürfen.",
  "Sollte sich das Sortiment in Zukunft ändern, werden rechtliche Hinweise und etwaige Schutzmaßnahmen transparent auf den betroffenen Produktseiten und im Checkout ausgewiesen.",
  "Unabhängig davon sind alle angebotenen Produkte entsprechend der gesetzlichen Vorgaben und Herstellerhinweise zu verwenden und außerhalb der Reichweite von Kindern aufzubewahren.",
];

export default function JugendschutzhinweisePage() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Jugendschutzhinweise
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Informationen zum Schutz Minderjähriger und zum aktuellen
              Sortiment.
            </p>
          </div>

          <div className="text-sm text-stone-700">
            {GUIDELINES.map((item, index) => (
              <p key={`${index}-${item}`} className={index === 0 ? "" : "mt-3"}>
                {item}
              </p>
            ))}
          </div>

        </div>
      </main>
    </PageLayout>
  );
}
