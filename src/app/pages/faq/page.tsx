import PageLayout from "@/components/PageLayout";
import FaqPageClient from "./FaqPageClient";

type FaqItem = { question: string; answer: string };
type FaqCategory = { label: string; items: FaqItem[] };

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    label: "Versand & Lieferung",
    items: [
      {
        question: "Wie lange dauert der Versand?",
        answer:
          "Bestellungen, die werktags bis 14:00 Uhr eingehen, bearbeiten wir in der Regel noch am selben Tag. Sofern beim Produkt nichts anderes angegeben ist, liegt die Lieferzeit meist bei 2-5 Werktagen innerhalb Deutschlands und 3-7 Werktagen innerhalb der EU.",
      },
      {
        question: "Wie wird verpackt?",
        answer:
          "Unsere Sendungen werden neutral und ohne unnötige Produktkennzeichnung verpackt. Relevante Versand- und Empfängerdaten bleiben natürlich sichtbar, damit die Zustellung reibungslos funktioniert.",
      },
      {
        question: "Ab wann ist der Versand kostenlos?",
        answer:
          "Ab einem Bestellwert von 69 € ist der Versand kostenlos. Unterhalb dieser Grenze berechnen wir eine Versandpauschale, die im Checkout angezeigt wird.",
      },
      {
        question: "Liefert ihr auch ins Ausland?",
        answer:
          "Ja. Wir liefern in viele EU-Länder und zusätzlich in ausgewählte weitere Länder. Die aktuell geltenden Versandkosten findest du auf unserer Seite „Versand & Zahlungsbedingungen“ und vor Abschluss der Bestellung nochmals im Checkout.",
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
          "Wir akzeptieren je nach Konfiguration und Gerät insbesondere Kartenzahlung, PayPal und Klarna. Apple Pay und Google Pay können zusätzlich verfügbar sein, wenn sie von Gerät, Browser und Zahlungsdienst unterstützt werden. Verbindlich sind die im Checkout angezeigten Methoden.",
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
          "Solange die Bestellung noch nicht final verarbeitet wurde, ist das teilweise möglich. Schreib uns am besten sofort mit deiner Bestellnummer an contact@smokeify.de.",
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
          "Melde deine Rücksendung bitte per E-Mail oder über das Retourenportal an. Bei einem regulären Widerruf trägst du die unmittelbaren Rücksendekosten selbst; bei beschädigten oder fehlerhaften Artikeln stellen wir ein Rücksendeetikett oder erstatten die Versandkosten.",
      },
      {
        question: "Wann erhalte ich meine Rückerstattung?",
        answer:
          "Sobald wir die Rücksendung erhalten und geprüft haben, erstatten wir den Betrag über deine ursprüngliche Zahlungsmethode. Spätestens erfolgt die Rückzahlung binnen 14 Tagen ab Zugang deines Widerrufs.",
      },
      {
        question: "Was mache ich, wenn ein Artikel beschädigt ankam?",
        answer:
          "Bitte fotografiere den Schaden und schreib uns umgehend an contact@smokeify.de. Wir regeln den Fall schnell und unbürokratisch – entweder mit einem Ersatz oder einer vollständigen Rückerstattung.",
      },
      {
        question: "Kann ich benutzte Hygiene-Artikel zurückgeben?",
        answer:
          "Aus hygienischen Gründen sind bereits benutzte Artikel in der Regel vom Widerruf ausgeschlossen. Wenn etwas defekt oder fehlerhaft ist, melde dich bitte direkt bei uns, damit wir eine Lösung finden.",
      },
    ],
  },
  {
    label: "Produkte, Setup & Beratung",
    items: [
      {
        question: "Welche Growbox-Größe passt zu meinem Raum?",
        answer:
          "Für kleine Flächen eignen sich kompakte Formate wie 60x60 cm. Wer mehr Flexibilität bei Licht, Abluft und Pflanzenhöhe braucht, plant meist mit 80x80 cm bis 120x120 cm. Entscheidend sind Grundfläche, Höhe und die passende Klima- und Lichttechnik.",
      },
      {
        question: "Welche Beleuchtung ist für Einsteiger sinnvoll?",
        answer:
          "Viele Einsteiger starten mit effizienten LED-Systemen, weil sie wenig Abwärme erzeugen und einfach zu steuern sind. Wichtig ist, dass Leistung, Abdeckung und Zeltgröße zusammenpassen.",
      },
      {
        question: "Wie halte ich mein Setup sauber und zuverlässig?",
        answer:
          "Regelmäßige Reinigung von Luftwegen, Filtern, Wasserleitungen und Auffangflächen hilft, Leistung und Hygiene stabil zu halten. Verwende dafür passende Reiniger, beachte Herstellerhinweise und lasse Komponenten vor der Wiederverwendung vollständig trocknen.",
      },
      {
        question: "Welches Zubehör wird oft zusammen gekauft?",
        answer:
          "Häufig kombiniert werden etwa Growbox + LED, Abluft + Aktivkohlefilter, Bewässerung + Schlauchsysteme oder Messgeräte + Klima-Zubehör. Auf den Produktseiten findest du passende Ergänzungen für ein stimmiges Setup.",
      },
      {
        question: "Bietet ihr persönliche Produktberatung an?",
        answer:
          "Ja. Wenn du unsicher bist, welches Zubehör zu deinem Bedarf passt, schreib uns per E-Mail an contact@smokeify.de oder über Instagram. Wir helfen dir schnell mit einer konkreten Empfehlung.",
      },
    ],
  },
  {
    label: "Rechtliche Hinweise",
    items: [
      {
        question: "Verkauft ihr altersbeschränkte Produkte?",
        answer:
          "Aktuell verkaufen wir keine Produkte, die nur an volljährige Personen abgegeben werden dürfen. Sollten wir unser Sortiment künftig erweitern, würden wir rechtliche Hinweise und Abläufe transparent im Shop ausweisen.",
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
          "Bitte kontaktiere uns so schnell wie möglich unter contact@smokeify.de. Bestellungen, die bereits versendet wurden, können nicht mehr storniert werden – in diesem Fall greift das Widerrufsrecht.",
      },
      {
        question: "Ich habe keine Bestellbestätigung erhalten – was tun?",
        answer:
          "Prüfe zuerst deinen Spam-Ordner. Wenn die Mail dort nicht zu finden ist, melde dich unter contact@smokeify.de mit deinem Namen und der E-Mail-Adresse, die du beim Kauf angegeben hast.",
      },
      {
        question: "Wo sehe ich den Status meiner Bestellung?",
        answer:
          "Sobald dein Paket unterwegs ist, erhältst du eine Versandbestätigung mit Tracking-Link. Mit Kundenkonto findest du zusätzlich deine Bestellhistorie direkt im Account-Bereich.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <PageLayout commerce={false}>
      <FaqPageClient categories={FAQ_CATEGORIES} />
    </PageLayout>
  );
}
