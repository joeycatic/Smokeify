import type { ShippingCountry } from "@/lib/shippingPolicy";

type CheckoutStartUrlOptions = {
  country?: ShippingCountry;
  discountCode?: string | null;
  useLoyaltyPoints?: boolean;
};

export const buildCheckoutStartUrl = (options?: CheckoutStartUrlOptions) => {
  const params = new URLSearchParams();

  if (options?.country) {
    params.set("country", options.country);
  }

  const discountCode = options?.discountCode?.trim();
  if (discountCode) {
    params.set("discountCode", discountCode);
  }

  if (options?.useLoyaltyPoints) {
    params.set("useLoyaltyPoints", "1");
  }

  const query = params.toString();
  return query ? `/checkout/start?${query}` : "/checkout/start";
};
