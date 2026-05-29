import PageLayout from "@/components/PageLayout";

export default function MaintenancePage() {
  return (
    <PageLayout commerce={false}>
      <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-6 py-16 text-center text-[var(--smk-text)]">
        <div className="smk-panel rounded-[40px] px-6 py-10 sm:px-10">
        <p className="smk-kicker">
          SMOKEIFY
        </p>
        <h1 className="smk-heading mt-4 text-4xl text-[var(--smk-text)] sm:text-5xl">
          Wir aktualisieren gerade unseren Store
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--smk-text-muted)] sm:text-base">
          Bitte schau gleich noch einmal vorbei. Wir sind in Kürze wieder für
          dich da.
        </p>
        </div>
      </div>
    </PageLayout>
  );
}
