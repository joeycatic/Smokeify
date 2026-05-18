import PageLayout from "@/components/PageLayout";
import CheckoutPaymentClient from "@/app/checkout/payment/CheckoutPaymentClient";

export default function CheckoutPaymentPage() {
  const publishableKey =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ??
    process.env.STRIPE_PUBLISHABLE_KEY ??
    "";

  return (
    <PageLayout commerce>
      <CheckoutPaymentClient publishableKey={publishableKey} />
    </PageLayout>
  );
}
