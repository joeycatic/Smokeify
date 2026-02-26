"use client";

import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import PageLayout from "@/components/PageLayout";
import Link from "next/link";

type FaqItem = { question: string; answer: string };
type FaqCategory = { label: string; items: FaqItem[] };

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    label: "Versand & Lieferung",
    items: [
      {
        question: "Wie lange dauert der Versand?",
        answer:
          "Bestellungen, die bis 14:00 Uhr eingehen, werden in der Regel noch am selben Werktag verschickt. Die Lieferzeit innerhalb Deutschlands beträgt 1–3 Werktage. In andere EU-Länder dauert es 3–7 Werktage.",
      },
      {
        question: "Welcher Versanddienstleister liefert meine Bestellung?",
        answer:
          "Wir versenden ausschließlich mit DHL. Nach dem Versand erhältst du eine E-Mail mit deiner Sendungsverfolgungsnummer, mit der du dein Paket jederzeit online tracken kannst.",
      },
      {
        question: "Ab wann ist der Versand kostenlos?",
        answer:
          "Ab einem Bestellwert von 69 € ist der Versand kostenlos. Unterhalb dieser Grenze berechnen wir eine Versandpauschale, die im Checkout angezeigt wird.",
      },
      {
        question: "Liefert ihr auch ins Ausland?",
        answer:
          "Ja, wir liefern in alle EU-Länder. Die genauen Versandkosten und Lieferzeiten für dein Land werden dir im Checkout angezeigt. Lieferungen außerhalb der EU sind derzeit nicht möglich.",
      },
    ],
  },
  {
    label: "Zahlung",
    items: [
      {
        question: "Welche Zahlungsarten akzeptiert ihr?",
        answer:
          "Wir akzeptieren alle gängigen Zahlungsmethoden: Kreditkarte (Visa, Mastercard), PayPal, Klarna (Ratenkauf & Sofortüberweisung) sowie SEPA-Lastschrift. Die verfügbaren Methoden werden dir beim Checkout angezeigt.",
      },
      {
        question: "Wann wird meine Zahlung belastet?",
        answer:
          "Die Zahlung wird bei Abschluss der Bestellung sofort eingezogen. Bei Klarna-Ratenkauf gelten die Bedingungen von Klarna.",
      },
      {
        question: "Ist meine Zahlung sicher?",
        answer:
          "Ja. Alle Zahlungen werden über Stripe abgewickelt – einen der weltweit führenden Zahlungsdienstleister. Deine Kartendaten werden ausschließlich verschlüsselt übertragen und nie auf unseren Servern gespeichert.",
      },
    ],
  },
  {
    label: "Rückgabe & Widerruf",
    items: [
      {
        question: "Wie lange habe ich das Rückgaberecht?",
        answer:
          "Du hast 14 Tage Widerrufsrecht ab Erhalt der Ware. Artikel müssen unbenutzt, vollständig und in der Originalverpackung zurückgesendet werden.",
      },
      {
        question: "Wie sende ich einen Artikel zurück?",
        answer:
          "Schreib uns einfach an joey@smokeify.de mit deiner Bestellnummer und dem Grund der Rücksendung. Wir senden dir dann ein Rücksendeetikett und weitere Anweisungen.",
      },
      {
        question: "Wann erhalte ich meine Rückerstattung?",
        answer:
          "Sobald wir die Rücksendung erhalten und geprüft haben, erstatten wir den Betrag innerhalb von 5–7 Werktagen auf deine ursprüngliche Zahlungsmethode zurück.",
      },
      {
        question: "Was mache ich, wenn ein Artikel beschädigt ankam?",
        answer:
          "Bitte fotografiere den Schaden und schreib uns umgehend an joey@smokeify.de. Wir regeln den Fall schnell und unbürokratisch – entweder mit einem Ersatz oder einer vollständigen Rückerstattung.",
      },
    ],
  },
  {
    label: "Produkte & Beratung",
    items: [
      {
        question: "Welche Zeltgröße ist die richtige für mich?",
        answer:
          `Das hängt vor allem von der Anzahl deiner Pflanzen und dem verfügbaren Platz ab. Als Faustregel: 60×60 cm für 1–2 Pflanzen, 80×80 cm für 2–3 Pflanzen, 100×100 cm für 4–6 Pflanzen. In unserem Blog-Artikel „Welches Pflanzenzelt für 2 Pflanzen" findest du eine ausführliche Erklärung.`,
      },
      {
        question: "Was ist in den Indoor-Sets enthalten?",
        answer:
          `Unsere Indoor-Sets enthalten in der Regel das Pflanzenzelt, eine LED-Leuchte, einen Ablüfter mit Kohlefilter und einen Umluftlüfter. Genaue Inhalte findest du auf der jeweiligen Produktseite unter „Lieferumfang".`,
      },
      {
        question: "Bietet ihr Produktberatung an?",
        answer:
          "Ja! Schreib uns auf Instagram oder per E-Mail an joey@smokeify.de – wir helfen dir gern, das passende Setup für deine Anforderungen zusammenzustellen.",
      },
      {
        question: "Sind eure Produkte mit Garantie versehen?",
        answer:
          "Alle Produkte unterliegen der gesetzlichen Gewährleistung von 2 Jahren. Viele Hersteller bieten darüber hinaus eigene Garantieleistungen an – diese sind auf der jeweiligen Produktseite angegeben.",
      },
    ],
  },
  {
    label: "Konto & Bestellungen",
    items: [
      {
        question: "Muss ich ein Konto erstellen, um zu bestellen?",
        answer:
          "Nein, du kannst auch als Gast bestellen. Mit einem Konto hast du jedoch den Vorteil, deine Bestellhistorie einzusehen, Produkte auf eine Wunschliste zu setzen und beim nächsten Einkauf schneller zur Kasse zu gehen.",
      },
      {
        question: "Kann ich meine Bestellung noch ändern oder stornieren?",
        answer:
          "Bitte kontaktiere uns so schnell wie möglich unter joey@smokeify.de. Bestellungen, die bereits versendet wurden, können nicht mehr storniert werden – in diesem Fall greift das Widerrufsrecht.",
      },
      {
        question: "Ich habe keine Bestellbestätigung erhalten – was tun?",
        answer:
          "Prüfe zuerst deinen Spam-Ordner. Wenn die Mail dort nicht zu finden ist, melde dich unter joey@smokeify.de mit deinem Namen und der E-Mail-Adresse, die du beim Kauf angegeben hast.",
      },
    ],
  },
];

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-black/6">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={index}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-stone-900 sm:text-base">
                {item.question}
              </span>
              <ChevronDownIcon
                className={`h-5 w-5 shrink-0 text-stone-400 transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                isOpen ? "grid-rows-[1fr] pb-4" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="text-sm leading-relaxed text-stone-600">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FaqPage() {
  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
            Häufige Fragen
          </h1>
          <p className="mt-3 text-base text-stone-500">
            Alles Wichtige rund um Bestellung, Versand und Produkte.
          </p>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          {FAQ_CATEGORIES.map((category) => (
            <section
              key={category.label}
              className="rounded-2xl border border-black/8 bg-white px-5 shadow-sm"
            >
              <h2 className="border-b border-black/6 py-4 text-xs font-bold uppercase tracking-widest text-emerald-800">
                {category.label}
              </h2>
              <FaqAccordion items={category.items} />
            </section>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-10 rounded-2xl bg-[#2f3e36] px-6 py-8 text-center text-white">
          <p className="text-base font-semibold">Deine Frage ist nicht dabei?</p>
          <p className="mt-1 text-sm text-white/70">
            Unser Support hilft dir direkt weiter.
          </p>
          <Link
            href="/pages/contact"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-white px-6 text-sm font-semibold text-[#2f3e36] transition hover:bg-white/90"
          >
            Kontakt aufnehmen
          </Link>
        </div>
      </main>
    </PageLayout>
  );
}
