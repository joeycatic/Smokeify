import Link from "next/link";
import PageLayout from "@/components/PageLayout";

export default function NotFound() {
  return (
    <PageLayout commerce>
      <div className="mx-auto flex min-h-[56vh] max-w-3xl items-center py-10 sm:py-16">
        <section className="gv-panel w-full rounded-[30px] px-6 py-10 text-center sm:px-10 sm:py-14">
          <span className="gv-chip">404</span>
          <h1 className="mt-5 font-[family:var(--font-syne)] text-4xl font-bold tracking-[-0.07em] text-[color:var(--gv-text)] sm:text-5xl">
            Diese Seite ist nicht da.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-[color:var(--gv-text-muted)] sm:text-base">
            Vielleicht wurde der Inhalt verschoben oder die Adresse ist nicht vollständig.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="smk-button-primary inline-flex min-h-12 items-center justify-center rounded-[18px] px-5 text-sm font-semibold">
              Zur Startseite
            </Link>
            <Link href="/products" className="smk-button-secondary inline-flex min-h-12 items-center justify-center rounded-[18px] px-5 text-sm font-semibold">
              Produkte entdecken
            </Link>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
