import type { ReactNode } from "react";
import Link from "next/link";
import { Info, Plus, Ruler, Truck, Wrench } from "lucide-react";
import { PDP_SHIPPING_RETURNS_SUMMARY } from "@/lib/storefrontTrust";
import { isTentCategory, parseTentDimensions } from "@/lib/tentDimensions";
import { normalizeTechnicalDetailsHtmlForDisplay } from "@/lib/technicalDetailsDisplay";
import TentTechnicalVisualization from "./TentTechnicalVisualization";

type ProductContentSectionsProps = {
  product: {
    title: string;
    descriptionHtml: string;
    technicalDetailsHtml?: string;
    shortDescription?: string | null;
    manufacturer?: string | null;
    growboxSize?: string | null;
    categories?: Array<{
      handle: string;
      title: string;
      parent?: { handle: string; title: string } | null;
    }>;
  };
};

function SectionShell({
  icon: Icon,
  title,
  eyebrow,
  children,
  className = "",
}: {
  icon: typeof Info;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[24px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] p-5 shadow-[var(--gv-shadow)] sm:p-6 ${className}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-lime)]/10 text-[color:var(--gv-lime)]">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          {eyebrow ? (
            <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]/85">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold text-[color:var(--gv-text)]">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function SectionAccordion({
  icon: Icon,
  title,
  eyebrow,
  defaultOpen = false,
  children,
}: {
  icon: typeof Info;
  title: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-[color:var(--gv-border)] bg-[color:var(--gv-dark)] shadow-[var(--gv-shadow)]">
      <details className="group" open={defaultOpen}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--gv-forest)] sm:px-6 sm:py-5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--gv-border)] bg-[color:var(--gv-lime)]/10 text-[color:var(--gv-lime)]">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              {eyebrow ? (
                <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-lime)]/85">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="mt-1 text-lg font-semibold text-[color:var(--gv-text)]">
                {title}
              </h2>
            </div>
          </div>
          <Plus className="h-5 w-5 shrink-0 text-[color:var(--gv-text-muted)] transition-transform duration-300 group-open:rotate-45" />
        </summary>
        <div className="grid grid-rows-[0fr] transition-all duration-500 ease-out group-open:grid-rows-[1fr]">
          <div className="overflow-hidden px-5 pb-5 sm:px-6 sm:pb-6">
            {children}
          </div>
        </div>
      </details>
    </section>
  );
}

export default function ProductContentSections({ product }: ProductContentSectionsProps) {
  const isTent = isTentCategory(product.categories);
  const tentDimensions = isTent
    ? parseTentDimensions(product.growboxSize ?? product.title)
    : null;
  const technicalDetailsHtml = normalizeTechnicalDetailsHtmlForDisplay(
    product.technicalDetailsHtml,
  );

  const quickFacts = [
    product.manufacturer ? { label: "Hersteller", value: product.manufacturer } : null,
    product.growboxSize ? { label: "Größe", value: product.growboxSize } : null,
    isTent ? { label: "Produkttyp", value: "Growzelt" } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (
    !product.shortDescription &&
    !technicalDetailsHtml &&
    !product.descriptionHtml &&
    !tentDimensions
  ) {
    return null;
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="px-2 sm:px-4">
        <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--gv-lime)]/88">
          Produktdetails
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--gv-text)]">
          Alles auf einem Blick
        </h2>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(240px,0.72fr)]">
        {technicalDetailsHtml || tentDimensions ? (
          <SectionAccordion
            icon={Wrench}
            title="Technische Details"
            eyebrow="Maße, Aufbau, Ausstattung"
            defaultOpen
          >
            <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_232px] 2xl:items-start">
              {tentDimensions ? (
                <div className="order-1 2xl:order-2 2xl:sticky 2xl:top-24">
                  <TentTechnicalVisualization dimensions={tentDimensions} />
                </div>
              ) : null}
              {technicalDetailsHtml ? (
                <div
                  className="product-description order-2 min-w-0 2xl:order-1"
                  dangerouslySetInnerHTML={{ __html: technicalDetailsHtml }}
                />
              ) : (
                <div className="product-description order-2 min-w-0 2xl:order-1">
                  <p>
                    Die visuellen Maßangaben stammen aus den vorhandenen Produktdaten und helfen dabei, die Stellfläche schneller einzuschätzen.
                  </p>
                </div>
              )}
            </div>
          </SectionAccordion>
        ) : null}

        <div className="space-y-4">
          <SectionShell icon={Ruler} title="Kurzüberblick" eyebrow="Schnell erfassen">
            <div className="space-y-4">
              {product.shortDescription ? (
                <p className="text-sm leading-7 text-[color:var(--gv-text-muted)]">
                  {product.shortDescription}
                </p>
              ) : (
                <p className="text-sm leading-7 text-[color:var(--gv-text-muted)]">
                  Die wichtigsten Produktangaben sind hier gebündelt, damit Größe, Material und Einsatzbereich schneller vergleichbar bleiben.
                </p>
              )}

              {quickFacts.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {quickFacts.map((fact) => (
                    <div key={fact.label} className="rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 py-3">
                      <p className="font-[family:var(--font-jetbrains-mono)] text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--gv-text-muted)]">
                        {fact.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--gv-text)]">
                        {fact.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </SectionShell>

          {product.descriptionHtml ? (
            <SectionAccordion icon={Info} title="Produktbeschreibung" eyebrow="Einsatz, Material, Besonderheiten">
              <div className="product-description" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
            </SectionAccordion>
          ) : null}

          <SectionAccordion icon={Truck} title="Versand & Rücksendungen" eyebrow="Lieferung transparent gehalten">
            <div className="space-y-4 text-sm text-[color:var(--gv-text-muted)]">
              <p className="leading-7">{PDP_SHIPPING_RETURNS_SUMMARY}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <Link className="rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 py-3 font-medium text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/45 hover:text-[color:var(--gv-lime)]" href="/pages/shipping">
                  Versanddetails ansehen
                </Link>
                <Link className="rounded-[20px] border border-[color:var(--gv-border)] bg-[color:var(--gv-surface)] px-4 py-3 font-medium text-[color:var(--gv-text)] transition hover:border-[color:var(--gv-lime)]/45 hover:text-[color:var(--gv-lime)]" href="/pages/return">
                  Rücksendungen ansehen
                </Link>
              </div>
            </div>
          </SectionAccordion>
        </div>
      </div>
    </section>
  );
}
