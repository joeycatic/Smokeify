import PageLayout from "@/components/PageLayout";

export default function ImprintPage() {
  const contactEmail = process.env.CONTACT_EMAIL?.trim() || "joey@smokeify.de";
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() || "";

  return (
    <PageLayout>
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
                <p className="font-semibold text-stone-900">Smokeify</p>
                <p>Joey Bennett Catic</p>
                <p>Brinkeweg 106a</p>
                <p>33758 Schloß Holte-Stukenbrock</p>
                <p>Deutschland</p>
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
                    className="block text-stone-700 hover:text-stone-900"
                  >
                    Telefon: {contactPhone}
                  </a>
                ) : null}
                <a
                  href="https://www.smokeify.de"
                  className="block text-stone-600 hover:text-stone-700"
                >
                  www.smokeify.de
                </a>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-semibold text-stone-900">
                Verantwortlich für den Inhalt
              </h2>
              <p className="text-sm text-stone-700 leading-relaxed">
                Joey Bennett Catic
              </p>
            </section>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}
