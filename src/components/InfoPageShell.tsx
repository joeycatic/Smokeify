import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: string;
  children: ReactNode;
};

export default function InfoPageShell({
  eyebrow = "Info",
  title,
  description,
  meta,
  children,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 lg:px-8">
      <section className="smk-panel relative overflow-hidden rounded-[34px] px-6 py-8 sm:px-8 sm:py-10">
        <div className="absolute left-0 top-0 h-44 w-44 -translate-x-10 -translate-y-10 rounded-full bg-[color:var(--smk-accent-2)]/12 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-52 w-52 translate-x-10 translate-y-10 rounded-full bg-[color:var(--smk-accent-2)]/10 blur-3xl" />
        <div className="relative">
          <span className="smk-chip">{eyebrow}</span>
          <h1 className="mt-5 font-[family:var(--font-fraunces)] text-4xl font-bold tracking-[-0.07em] text-[color:var(--smk-text)] sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--smk-text-muted)] sm:text-base">
              {description}
            </p>
          ) : null}
          {meta ? (
            <p className="mt-4 font-[family:var(--font-manrope)] text-[11px] uppercase tracking-[0.18em] text-[color:var(--smk-text-muted)]">
              {meta}
            </p>
          ) : null}
        </div>
      </section>

      <section className="smk-panel mt-8 rounded-[34px] px-6 py-6 sm:px-8 sm:py-8">
        {children}
      </section>
    </main>
  );
}

