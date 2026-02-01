import PageLayout from "@/components/PageLayout";

const GUIDELINES = [
  "Der Schutz von Kindern und Jugendlichen ist uns ein wichtiges Anliegen. Daher verkaufen wir unsere Produkte ausschließlich an volljährige Personen (ab 18 Jahren).",
  "Mit dem Abschluss einer Bestellung bestätigen Sie, dass Sie das 18. Lebensjahr vollendet haben und berechtigt sind, die angebotenen Produkte zu erwerben.",
  "Wir behalten uns vor:",
  "Bestellungen abzulehnen, wenn ein begründeter Verdacht auf Minderjährigkeit besteht,",
  "im Einzelfall eine Altersprüfung (z. B. durch Ausweiskontrolle) anzufordern,",
  "eine Zustellung nur nach erfolgreicher Altersprüfung vorzunehmen.",
  "Eine Abgabe an Minderjährige ist ausgeschlossen.",
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
              Wichtige Informationen zum Schutz von Minderjährigen.
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
