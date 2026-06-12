import PageLayout from "@/components/PageLayout";
import CheckoutPaymentClient from "@/app/checkout/payment/CheckoutPaymentClient";

export default function CheckoutPaymentPage() {
  return (
    <PageLayout commerce>
      <CheckoutPaymentClient />
    </PageLayout>
  );
}
