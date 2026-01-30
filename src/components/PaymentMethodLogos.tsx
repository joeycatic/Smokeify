type PaymentMethodLogo = {
  label: string;
  src: string;
};

const PAYMENT_METHODS: PaymentMethodLogo[] = [
  { label: "Kreditkarte", src: "/payment-logos/creditcard@2x.png" },
  { label: "Apple Pay", src: "/payment-logos/applepay@2x.png" },
  { label: "Google Pay", src: "/payment-logos/google-pay-mark.png" },
  { label: "Klarna", src: "/payment-logos/klarnaOne@2x.png" },
  { label: "PayPal", src: "/payment-logos/paypal@2x.png" },
];

export default function PaymentMethodLogos({
  className = "gap-3",
  logoClassName = "",
  pillClassName = "",
}: {
  className?: string;
  logoClassName?: string;
  pillClassName?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center text-[11px] ${className}`}>
      {PAYMENT_METHODS.map((method) => (
        <span
          key={method.label}
          className={`inline-flex h-8 items-center rounded-full border border-white/15 bg-white/5 px-3 ${pillClassName}`}
        >
          <img
            src={method.src}
            alt={method.label}
            className={`h-5 w-auto object-contain ${logoClassName}`}
            loading="lazy"
            decoding="async"
          />
        </span>
      ))}
    </div>
  );
}
