import PageLayout from "@/components/PageLayout";

const FAQ_ITEMS = [
  {
    question: "Wie lange dauert der Versand?",
    answer:
      "In der Regel 2-7 Werktage innerhalb der EU. Lieferzeiten können je nach Zielland variieren.",
  },
  {
    question: "Welche Zahlungsarten werden akzeptiert?",
    answer:
      "Wir akzeptieren die im Checkout angezeigten Zahlungsarten, z. B. PayPal, Kreditkarte oder weitere Anbieter.",
  },
  {
    question: "Kann ich meine Bestellung stornieren?",
    answer:
      "Bitte kontaktiere uns so schnell wie möglich. Sobald eine Bestellung versandt wurde, ist eine Stornierung nicht mehr möglich.",
  },
  {
    question: "Wie funktioniert eine Rückgabe?",
    answer:
      "Du kannst deine Bestellung innerhalb von 14 Tagen widerrufen. Details findest du in der Rueckgabe- und Retourenrichtlinie.",
  },
  {
    question: "Wie erreiche ich den Support?",
    answer:
      "Schreib uns an joey@smokeify.de. Wir melden uns so schnell wie möglich zurück.",
  },
];

export default function FaqPage() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              FAQ
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Antworten auf die häufigsten Fragen.
            </p>
          </div>

          <div className="space-y-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="rounded-2xl border border-black/10 bg-white px-5 py-4"
              >
                <summary className="cursor-pointer list-none text-base font-semibold text-stone-900">
                  {item.question}
                </summary>
                <p className="mt-3 text-sm text-stone-700 leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
