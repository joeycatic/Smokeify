"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-4 py-12 sm:px-6">
      <section className="gv-panel w-full rounded-[30px] px-6 py-10 text-center sm:px-10">
        <span className="gv-chip">Fehler</span>
        <h1 className="mt-5 font-[family:var(--font-syne)] text-4xl font-bold tracking-[-0.07em] text-[color:var(--gv-text)]">
          Etwas ist schiefgelaufen.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[color:var(--gv-text-muted)]">
          Bitte versuche es noch einmal. Warenkorb und Kontodaten bleiben dabei erhalten.
        </p>
        <button type="button" onClick={reset} className="smk-button-primary mt-7 min-h-12 rounded-[18px] px-5 text-sm font-semibold">
          Erneut versuchen
        </button>
      </section>
    </div>
  );
}
