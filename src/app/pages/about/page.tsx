import InfoPageShell from "@/components/InfoPageShell";
import { businessDetails } from "@/lib/businessDetails";

const ABOUT_POINTS = [
  "Kuratierte Auswahl mit Fokus auf Zuverlässigkeit, Lieferfähigkeit und nachvollziehbare Produktinformationen.",
  "Klare Infos zu Versand, Rückgabe, Verfügbarkeit und Kontakt ohne versteckte Bedingungen.",
  "Persönlicher Support bei Fragen zu Produkten, Bestellung und Lieferung.",
];

export default function AboutPage() {
  const {
    cityPostalLine,
    companyName,
    contactEmail,
    contactPhone,
    country,
    legalName,
    streetLine,
    vatId,
    websiteLabel,
  } = businessDetails;

  return (
    <InfoPageShell
      eyebrow="Über uns"
      title="Über Smokeify"
      description="Smokeify ist ein deutscher Shop für Indoor-Gartentechnik, Pflanzenpflege und funktionale Home-Grow-Setups. Wir legen Wert auf transparente Produktangaben, erreichbaren Support und nachvollziehbare Shop-Informationen."
    >
      <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
        <p className="text-sm leading-7 text-[color:var(--smk-text-muted)]">
          Smokeify ist die Shop-Marke. Rechtlicher Anbieter und Betreiber
          dieses Onlineshops ist{" "}
          <span className="font-semibold text-[color:var(--smk-text)]">
            {legalName}
          </span>
          .
        </p>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
          <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent)]">
            Anbieter
          </p>
          <div className="mt-4 space-y-2 text-sm leading-7 text-[color:var(--smk-text-muted)]">
            <p className="font-semibold text-[color:var(--smk-text)]">
              {companyName}
            </p>
            <p>{legalName}</p>
            <p>{streetLine}</p>
            <p>{cityPostalLine}</p>
            <p>{country}</p>
            {vatId ? <p>USt-IdNr.: {vatId}</p> : null}
          </div>
        </section>

        <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
          <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent)]">
            Kontakt
          </p>
          <div className="mt-4 space-y-2 text-sm leading-7 text-[color:var(--smk-text-muted)]">
            <p>E-Mail: {contactEmail}</p>
            {contactPhone ? <p>Telefon: {contactPhone}</p> : null}
            <p>Website: {websiteLabel}</p>
            <p>Support über Kontaktformular, E-Mail und Telefon.</p>
          </div>
        </section>
      </div>

      <section className="mt-5 smk-surface rounded-[28px] px-5 py-5 sm:px-6">
        <h2 className="text-xl font-semibold text-[color:var(--smk-text)]">
          Wofür wir stehen
        </h2>
        <ul className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--smk-text-muted)]">
          {ABOUT_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm leading-7 text-[color:var(--smk-text-muted)]">
          Transparente Informationen zu Versand, Rückgabe, Datenschutz,
          Widerruf und Kontakt findest du jederzeit im Footer sowie auf den
          entsprechenden Infoseiten unseres Shops.
        </p>
      </section>
    </InfoPageShell>
  );
}
