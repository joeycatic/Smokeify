import InfoPageShell from "@/components/InfoPageShell";
import { businessDetails } from "@/lib/businessDetails";

export default function ImprintPage() {
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
    websiteUrl,
  } = businessDetails;

  return (
    <InfoPageShell
      eyebrow="Impressum"
      title="Impressum"
      description="Angaben zum rechtlichen Anbieter, zu Kontaktmöglichkeiten und zur Verantwortlichkeit für diese Website."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
          <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent)]">
            Anbieter
          </p>
          <div className="mt-4 text-sm leading-7 text-[color:var(--smk-text-muted)]">
            <p className="font-semibold text-[color:var(--smk-text)]">
              {companyName}
            </p>
            <p>{legalName}</p>
            <p>{streetLine}</p>
            <p>{cityPostalLine}</p>
            <p>{country}</p>
          </div>
        </section>

        <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
          <p className="font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-accent)]">
            Kontakt
          </p>
          <div className="mt-4 text-sm leading-7 text-[color:var(--smk-text-muted)]">
            <a
              href={`mailto:${contactEmail}`}
              className="block font-semibold text-[color:var(--smk-text)] transition hover:text-[color:var(--smk-accent)]"
            >
              {contactEmail}
            </a>
            {contactPhone ? (
              <a
                href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                className="block transition hover:text-[color:var(--smk-text)]"
              >
                {contactPhone}
              </a>
            ) : null}
            <a
              href={websiteUrl}
              className="block transition hover:text-[color:var(--smk-text)]"
            >
              {websiteLabel}
            </a>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {vatId ? (
          <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
            <h2 className="text-xl font-semibold text-[color:var(--smk-text)]">
              Umsatzsteuer-ID
            </h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--smk-text-muted)]">
              USt-IdNr.: {vatId}
            </p>
          </section>
        ) : null}

        <section className="smk-surface rounded-[28px] px-5 py-5 sm:px-6">
          <h2 className="text-xl font-semibold text-[color:var(--smk-text)]">
            Verantwortlich für den Inhalt
          </h2>
          <p className="mt-4 text-sm leading-7 text-[color:var(--smk-text-muted)]">
            {legalName}
          </p>
        </section>
      </div>
    </InfoPageShell>
  );
}
