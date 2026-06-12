import PageLayout from "@/components/PageLayout";
import type { ShippingCountry } from "@/lib/shippingPolicy";
import CheckoutStartClient from "@/app/checkout/start/CheckoutStartClient";

const toShippingCountry = (value?: string): ShippingCountry => {
  const normalized = value?.trim().toUpperCase();
  switch (normalized) {
    case "AT":
    case "CH":
    case "DE":
    case "EU":
    case "OTHER":
    case "UK":
    case "US":
      return normalized;
    default:
      return "DE";
  }
};

export default async function CheckoutStartPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const country = toShippingCountry(
    Array.isArray(resolvedSearchParams.country)
      ? resolvedSearchParams.country[0]
      : resolvedSearchParams.country,
  );
  const discountCode = Array.isArray(resolvedSearchParams.discountCode)
    ? resolvedSearchParams.discountCode[0] ?? ""
    : resolvedSearchParams.discountCode ?? "";
  const recoverySessionId = Array.isArray(resolvedSearchParams.recoverySession)
    ? resolvedSearchParams.recoverySession[0] ?? ""
    : resolvedSearchParams.recoverySession ?? "";
  const useLoyaltyPoints = Array.isArray(resolvedSearchParams.useLoyaltyPoints)
    ? resolvedSearchParams.useLoyaltyPoints[0] === "1"
    : resolvedSearchParams.useLoyaltyPoints === "1";
  return (
    <PageLayout commerce>
      <CheckoutStartClient
        initialCountry={country}
        initialDiscountCode={discountCode}
        initialRecoverySessionId={recoverySessionId}
        initialUseLoyaltyPoints={useLoyaltyPoints}
      />
    </PageLayout>
  );
}
