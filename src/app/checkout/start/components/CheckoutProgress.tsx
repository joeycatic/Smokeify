"use client";

import { Check, Leaf, PackageCheck, Sprout, WalletCards } from "lucide-react";

const steps = [
  { id: "cart", label: "Warenkorb", shortLabel: "Warenkorb", icon: Sprout },
  { id: "address", label: "Lieferdaten", shortLabel: "Lieferung", icon: Leaf },
  { id: "payment", label: "Zahlung", shortLabel: "Zahlung", icon: WalletCards },
  { id: "confirmation", label: "Bestätigung", shortLabel: "Fertig", icon: PackageCheck },
] as const;

export type CheckoutStep = (typeof steps)[number]["id"];

type CheckoutProgressProps = {
  currentStep: CheckoutStep;
  onStepClick?: (step: CheckoutStep) => void;
};

export default function CheckoutProgress({
  currentStep,
  onStepClick,
}: CheckoutProgressProps) {
  const current = steps.findIndex((step) => step.id === currentStep);

  return (
    <nav aria-label="Checkout-Fortschritt" className="px-1 sm:px-2">
      <ol className="grid grid-cols-4">
        {steps.map((step, index) => {
          const isComplete = index < current;
          const isCurrent = index === current;
          const isClickable = Boolean(onStepClick) && index <= current;
          const Icon = step.icon;
          const marker = (
            <span
              className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border transition sm:h-10 sm:w-10 ${
                isCurrent
                  ? "border-[color:var(--gv-lime)] bg-[color:var(--gv-lime)] text-white shadow-[0_7px_20px_rgba(31,95,63,0.22)]"
                  : isComplete
                    ? "border-emerald-800/15 bg-emerald-100 text-emerald-800"
                    : "border-[color:var(--gv-border)] bg-white text-[color:var(--gv-text-muted)]"
              }`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {isComplete ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
          );

          return (
            <li key={step.id} className="relative flex flex-col items-center text-center">
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={`absolute right-1/2 top-[18px] h-px w-full sm:top-5 ${
                    index <= current ? "bg-emerald-700/35" : "bg-emerald-950/10"
                  }`}
                />
              ) : null}
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  className="relative z-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gv-lime)] focus-visible:ring-offset-2"
                  aria-label={`${step.label}${isComplete ? ", abgeschlossen" : ""}`}
                >
                  {marker}
                </button>
              ) : (
                marker
              )}
              <span
                className={`mt-2 text-[10px] font-semibold sm:text-xs ${
                  isCurrent
                    ? "text-[color:var(--gv-lime)]"
                    : "text-[color:var(--gv-text-muted)]"
                }`}
              >
                <span className="sm:hidden">{step.shortLabel}</span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
