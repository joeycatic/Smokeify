import PageLayout from "@/components/PageLayout";
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
    <PageLayout commerce={false}>
      <main className="mx-auto w-full max-w-5xl px-6 py-12 text-stone-800">
        <div className="rounded-3xl border border-black/10 bg-white/90 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-[#2f3e36]">
              Impressum
            </h1>
          </div>

          <div className="space-y-8">
            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-stone-900">Anbieter</h2>
              <div className="text-sm text-stone-700 leading-relaxed">
                <p className="font-semibold text-stone-900">{companyName}</p>
                <p>{legalName}</p>
                <p>{streetLine}</p>
                <p>{cityPostalLine}</p>
                <p>{country}</p>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-stone-900">Kontakt</h2>
              <div className="text-sm text-stone-700 leading-relaxed">
                <a
                  href={`mailto:${contactEmail}`}
                  className="block font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {contactEmail}
                </a>
                {contactPhone ? (
                  <a
                    href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                    className="block text-stone-600 hover:text-stone-700"
                  >
                    {contactPhone}
                  </a>
                ) : null}
                <a
                  href={websiteUrl}
                  className="block text-stone-600 hover:text-stone-700"
                >
                  {websiteLabel}
                </a>
              </div>
            </section>

            {vatId ? (
              <section className="space-y-3">
                <h2 className="text-xl font-semibold text-stone-900">
                  Umsatzsteuer-ID
                </h2>
                <p className="text-sm text-stone-700 leading-relaxed">
                  USt-IdNr.: {vatId}
                </p>
              </section>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-stone-900">
                Verantwortlich für den Inhalt
              </h2>
              <p className="text-sm text-stone-700 leading-relaxed">
                {legalName}
              </p>
            </section>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
