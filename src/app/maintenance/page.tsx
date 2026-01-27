import PageLayout from "@/components/PageLayout";

export default function MaintenancePage() {
  return (
    <PageLayout>
      <div className="mx-auto flex min-h-[70vh] max-w-4xl flex-col items-center justify-center px-6 py-16 text-center text-stone-800">
        <p className="text-xs font-semibold tracking-[0.3em] text-[#2f3e36]/70">
          SMOKEIFY
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[#2f3e36] sm:text-4xl">
          Wir aktualisieren gerade unseren Store
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600 sm:text-base">
          Bitte schau gleich noch einmal vorbei. Wir sind in Kürze wieder für
          dich da.
        </p>
      </div>
    </PageLayout>
  );
}
