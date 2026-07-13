import Image from "next/image";
import { CircleCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import PaymentMethodLogos from "@/components/PaymentMethodLogos";
import { PDP_FEATURE_ITEMS, PDP_TRUST_CARDS } from "@/lib/storefrontTrust";

const trustItems = [
  { icon: Truck, eyebrow: "Lieferung", ...PDP_TRUST_CARDS[0] },
  { icon: ShieldCheck, eyebrow: "Zahlung", ...PDP_TRUST_CARDS[1] },
  { icon: RotateCcw, eyebrow: "Rückgabe", ...PDP_TRUST_CARDS[2] },
];

export default function ProductDetailTrustBlock() {
  return (
    <section aria-label="Kaufsicherheit" className="mt-5">
      <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {trustItems.map((item, index) => (
          <div
            key={item.title}
            className="group relative min-h-[124px] overflow-hidden rounded-[22px] border border-[color:var(--gv-border)]/80 bg-white/75 p-3.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--gv-lime)]/30 hover:bg-white hover:shadow-[var(--gv-shadow)] sm:min-h-[148px] sm:p-4"
          >
            <span
              aria-hidden="true"
              className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[color:var(--gv-lime)]/70 transition-all duration-200 group-hover:inset-x-3"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-8 -right-5 text-7xl font-black leading-none text-[color:var(--gv-lime)]/[0.045]"
            >
              0{index + 1}
            </span>
            <div className="relative flex items-start justify-between gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--gv-lime)]/30 bg-[color:var(--gv-lime)]/12 text-[color:var(--gv-lime-dim)] shadow-sm transition-transform duration-200 group-hover:rotate-[-4deg] group-hover:scale-105">
                <item.icon className="h-5 w-5" strokeWidth={2.5} />
              </span>
              <span className="pt-1 font-[family:var(--font-jetbrains-mono)] text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--gv-text-muted)]">
                {item.eyebrow}
              </span>
            </div>
            <p className="relative mt-3 text-[15px] font-bold leading-tight text-[color:var(--gv-text)]">
              {item.title}
            </p>
            <p className="relative mt-1.5 text-xs leading-relaxed text-[color:var(--gv-text-muted)]">
              {item.detail}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t border-[color:var(--gv-border)]/70 pt-3 sm:mt-4 sm:gap-4 sm:pt-4">
        <div
          aria-label="Zahlungsarten und Versand"
          className="flex min-w-0 flex-wrap items-center justify-start gap-2"
        >
          <PaymentMethodLogos
            className="flex-wrap justify-start gap-2"
            pillClassName="h-8 border-[color:var(--gv-border)] bg-white/80 px-3"
            logoClassName="h-5"
          />
          <span className="inline-flex h-8 shrink-0 items-center rounded-full border border-[color:var(--gv-border)] bg-white/80 px-3">
            <Image
              src="/shipping-provider-logos/dhl-logo.png"
              alt="DHL"
              className="h-5 w-[30px] object-contain"
              width={30}
              height={20}
              sizes="30px"
            />
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[color:var(--gv-text-muted)]">
          {PDP_FEATURE_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-1.5">
              <CircleCheck className="h-4 w-4 shrink-0 text-[color:var(--gv-lime-dim)]" strokeWidth={2.5} />
              <span className="font-medium">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
