import Image from "next/image";

type PaymentMethodLogo = {
  id: string;
  label: string;
  src: string;
};

const PAYMENT_METHODS_BY_ID: Record<string, PaymentMethodLogo> = {
  card: { id: "card", label: "Kreditkarte", src: "/payment-logos/creditcard@2x.png" },
  apple_pay: { id: "apple_pay", label: "Apple Pay", src: "/payment-logos/applepay@2x.png" },
  google_pay: { id: "google_pay", label: "Google Pay", src: "/payment-logos/google-pay-mark.png" },
  klarna: { id: "klarna", label: "Klarna", src: "/payment-logos/klarnaOne@2x.png" },
  paypal: { id: "paypal", label: "PayPal", src: "/payment-logos/paypal@2x.png" },
};

const DEFAULT_METHOD_IDS = ["card", "apple_pay", "google_pay"];

const parseMethodIds = (raw: string | undefined) => {
  if (!raw) return DEFAULT_METHOD_IDS;
  const ids = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const deduped = Array.from(new Set(ids));
  const known = deduped.filter((id) => PAYMENT_METHODS_BY_ID[id]);
  return known.length ? known : DEFAULT_METHOD_IDS;
};

const getDisplayedPaymentMethods = (): PaymentMethodLogo[] => {
  const configuredIds = parseMethodIds(process.env.NEXT_PUBLIC_PAYMENT_METHOD_LOGOS);
  return configuredIds.map((id) => PAYMENT_METHODS_BY_ID[id]);
};

const PAYMENT_METHODS = getDisplayedPaymentMethods();

const disclaimer =
  "Verbindlich sind die im Checkout angezeigten Zahlungsarten.";

export default function PaymentMethodLogos({
  className = "flex-wrap gap-3 sm:gap-3",
  logoClassName = "",
  pillClassName = "",
  showDisclaimer = false,
}: {
  className?: string;
  logoClassName?: string;
  pillClassName?: string;
  showDisclaimer?: boolean;
}) {
  return (
    <div>
      <div className={`flex items-center text-[11px] ${className}`}>
        {PAYMENT_METHODS.map((method) => (
          <span
            key={method.id}
            className={`inline-flex h-8 items-center rounded-full border border-white/15 bg-white/5 px-3 ${pillClassName}`}
          >
            <Image
              src={method.src}
              alt={method.label}
              width={56}
              height={20}
              className={`h-5 w-auto object-contain ${logoClassName}`}
              loading="lazy"
              quality={70}
            />
          </span>
        ))}
      </div>
      {showDisclaimer ? (
        <p className="mt-2 text-[11px] text-white/65">{disclaimer}</p>
      ) : null}
    </div>
  );
}
