import { PLANT_ANALYZER_PATH } from "@/lib/plantAnalyzerPaths";

export const SMOKEIFY_ROUTES = {
  home: "/",
  products: "/products",
  customizer: "/customizer",
  analyzer: PLANT_ANALYZER_PATH,
  blog: "/blog",
  cart: "/cart",
  compare: "/products/compare",
  lab: "/lab",
  checkoutCtaLab: "/lab/checkout-cta",
} as const;

