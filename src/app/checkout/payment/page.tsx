import type { Metadata } from "next";
import CheckoutShell from "@/components/checkout/CheckoutShell";
import CheckoutPaymentClient from "@/app/checkout/payment/CheckoutPaymentClient";

export const metadata: Metadata = {
  title: "Zahlung abschließen",
  description: "Sichere Zahlungsweiterleitung für deine Bestellung.",
  robots: { index: false, follow: false },
};

export default function CheckoutPaymentPage() {
  return (
    <CheckoutShell returnHref="/checkout/start" returnLabel="Zurück zu den Lieferdaten">
      <CheckoutPaymentClient />
    </CheckoutShell>
  );
}
