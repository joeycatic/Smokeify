export const STOREFRONT_ANALYTICS_EVENTS = {
  customizerStepView: "storefront_customizer_step_view",
  customizerAddToCart: "storefront_customizer_add_to_cart",
  customizerCheckout: "storefront_customizer_checkout",
  analyzerSubmit: "storefront_analyzer_submit",
  analyzerResultView: "storefront_analyzer_result_view",
  analyzerProductClick: "storefront_analyzer_product_click",
} as const;

export type StorefrontAnalyticsEventName =
  (typeof STOREFRONT_ANALYTICS_EVENTS)[keyof typeof STOREFRONT_ANALYTICS_EVENTS];

