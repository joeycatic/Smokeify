import PageLayout from "@/components/PageLayout";

const ABOUT_POINTS = [
  "Kuratierte Auswahl mit Fokus auf Zuverlässigkeit, Lieferfähigkeit und nachvollziehbare Produktinformationen.",
  "Klare Infos zu Versand, Rückgabe, Verfügbarkeit und Kontakt ohne versteckte Bedingungen.",
  "Persönlicher Support bei Fragen zu Produkten, Bestellung und Lieferung.",
];

export default function AboutPage() {
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    "contact@smokeify.de";
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "";

  return (
    <PageLayout>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Über Smokeify
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600">
              Smokeify ist ein deutscher Online-Shop für Technik, Zubehör und
              Ausstattung rund um Indoor-Gartenbau, Pflanzenpflege und
              funktionale Home-Grow-Setups. Wir legen Wert auf transparente
              Produktangaben, erreichbaren Support und nachvollziehbare
              Shop-Informationen.
            </p>
          </div>

          <div className="grid gap-6 border-b border-black/10 pb-6 md:grid-cols-2">
            <div className="space-y-2 text-sm text-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Anbieter
              </p>
              <p className="font-semibold text-stone-900">Smokeify</p>
              <p>Joey Bennett Catic</p>
              <p>Brinkeweg 106a</p>
              <p>33758 Schloß Holte-Stukenbrock</p>
              <p>Deutschland</p>
            </div>
            <div className="space-y-2 text-sm text-stone-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Kontakt
              </p>
              <p>E-Mail: {contactEmail}</p>
              {contactPhone ? <p>Telefon: {contactPhone}</p> : null}
              <p>Website: www.smokeify.de</p>
              <p>Support über Kontaktformular, E-Mail und Telefon.</p>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-stone-900">
              Wofür wir stehen
            </h2>
            <ul className="space-y-3 text-sm leading-relaxed text-stone-700">
              {ABOUT_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <p className="text-sm leading-relaxed text-stone-700">
              Transparente Informationen zu Versand, Rückgabe, Datenschutz,
              Widerruf und Kontakt findest du jederzeit im Footer sowie auf den
              entsprechenden Infoseiten unseres Shops.
            </p>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
