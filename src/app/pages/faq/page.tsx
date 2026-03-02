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
          "Bestellungen, die werktags bis 14:00 Uhr eingehen, versenden wir in der Regel noch am selben Tag. Innerhalb Deutschlands liegt die Lieferzeit meist bei 1-3 Werktagen, innerhalb der EU bei 3-7 Werktagen.",
      },
      {
        question: "Wird diskret verpackt?",
        answer:
          "Ja. Unsere Sendungen werden neutral und ohne auffällige Produktkennzeichnung verpackt. So bleibt der Inhalt von außen nicht erkennbar.",
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
      {
        question: "Erhalte ich eine Sendungsverfolgung?",
        answer:
          "Ja. Nach dem Versand bekommst du automatisch eine E-Mail mit Tracking-Link, damit du den Status deiner Bestellung jederzeit verfolgen kannst.",
      },
    ],
  },
  {
    label: "Zahlung",
    items: [
      {
        question: "Welche Zahlungsarten akzeptiert ihr?",
        answer:
          "Wir akzeptieren gängige Zahlungsarten wie Kreditkarte (Visa, Mastercard), PayPal, Klarna und SEPA-Lastschrift. Die für deine Bestellung verfügbaren Methoden werden dir im Checkout angezeigt.",
      },
      {
        question: "Wann wird meine Zahlung belastet?",
        answer:
          "Die Zahlung wird bei Abschluss der Bestellung autorisiert bzw. eingezogen. Bei Klarna gelten die jeweiligen Klarna-Bedingungen für die gewählte Zahlungsart.",
      },
      {
        question: "Ist meine Zahlung sicher?",
        answer:
          "Ja. Alle Zahlungen werden über Stripe abgewickelt – einen der weltweit führenden Zahlungsdienstleister. Deine Kartendaten werden ausschließlich verschlüsselt übertragen und nie auf unseren Servern gespeichert.",
      },
      {
        question: "Kann ich nachträglich die Zahlungsart ändern?",
        answer:
          "Solange die Bestellung noch nicht final verarbeitet wurde, ist das teilweise möglich. Schreib uns am besten sofort mit deiner Bestellnummer an joey@smokeify.de.",
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
      {
        question: "Kann ich benutzte Hygiene-Artikel zurückgeben?",
        answer:
          "Aus hygienischen Gründen sind bereits benutzte Artikel in der Regel vom Widerruf ausgeschlossen. Wenn etwas defekt oder fehlerhaft ist, melde dich bitte direkt bei uns, damit wir eine Lösung finden.",
      },
    ],
  },
  {
    label: "Produkte, Nutzung & Beratung",
    items: [
      {
        question: "Welche Grinder-Größe passt zu mir?",
        answer:
          "Für unterwegs reicht meist ein kompakter Grinder (ca. 40-50 mm). Für den täglichen Gebrauch zuhause empfehlen wir mittlere bis große Modelle (55-63 mm), da sie mehr Volumen und meist eine angenehmere Handhabung bieten.",
      },
      {
        question: "Welche Papers sind für Einsteiger sinnvoll?",
        answer:
          "Viele starten mit King Size Slim Papers, weil sie gut zu rollen sind und breit verfügbar. Wenn du langsameres Abbrennen willst, sind ungebleichte Varianten eine gute Option. Achte zusätzlich auf passende Filter Tips.",
      },
      {
        question: "Wie reinige ich Bong, Pfeife oder Grinder richtig?",
        answer:
          "Am besten regelmäßig mit geeignetem Cleaner und warmem Wasser reinigen. Bei Grindern zuerst trocken ausbürsten, dann nur falls nötig mit etwas Isopropanol arbeiten und anschließend vollständig trocknen lassen. So bleiben Geschmack und Funktion erhalten.",
      },
      {
        question: "Welches Zubehör wird oft zusammen gekauft?",
        answer:
          "Beliebte Kombinationen sind: Papers + Filter Tips, Grinder + Aufbewahrungsdose, Bong + Reinigungszubehör. Auf den Produktseiten findest du passende Ergänzungen für ein stimmiges Setup.",
      },
      {
        question: "Bietet ihr persönliche Produktberatung an?",
        answer:
          "Ja. Wenn du unsicher bist, welches Zubehör zu deinem Bedarf passt, schreib uns per E-Mail an joey@smokeify.de oder über Instagram. Wir helfen dir schnell mit einer konkreten Empfehlung.",
      },
    ],
  },
  {
    label: "Jugendschutz & rechtliche Hinweise",
    items: [
      {
        question: "Ab welchem Alter kann ich bestellen?",
        answer:
          "Bestellungen in unserem Headshop sind nur für volljährige Personen bestimmt. Mit der Bestellung bestätigst du, dass du mindestens 18 Jahre alt bist.",
      },
      {
        question: "Verkauft ihr verbotene Substanzen?",
        answer:
          "Nein. Wir verkaufen ausschließlich legales Zubehör und erlaubte Produkte. Die Verantwortung für eine rechtmäßige Nutzung liegt immer bei der kaufenden Person.",
      },
      {
        question: "Kann ich den Versand an eine Packstation senden lassen?",
        answer:
          "In vielen Fällen ist der Versand an eine Packstation möglich. Bitte achte im Checkout auf korrekte Daten und prüfe, ob die gewählte Versandart dafür unterstützt wird.",
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
      {
        question: "Wo sehe ich den Status meiner Bestellung?",
        answer:
          "Sobald dein Paket unterwegs ist, erhältst du eine Versandbestätigung mit Tracking-Link. Mit Kundenkonto findest du zusätzlich deine Bestellhistorie direkt im Account-Bereich.",
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
            Alles Wichtige rund um Bestellung, diskreten Versand und Headshop-Zubehör.
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
