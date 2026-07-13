import type { GrowvaultIconName } from "@/components/icons/GrowvaultIcon";

export const PRODUCT_CATEGORY_ICONS = [
  { label: "Growzelte", href: "/zelte", icon: "tent" },
  { label: "Licht", href: "/licht", icon: "light" },
  { label: "Luft & Klima", href: "/luft", icon: "fan" },
  { label: "Bewässerung", href: "/bewaesserung", icon: "water" },
  { label: "Messen & Steuern", href: "/messen", icon: "gauge" },
  { label: "Substrate", href: "/duenger", icon: "soil" },
  { label: "Zubehör", href: "/zubehoer", icon: "package" },
] as const satisfies ReadonlyArray<{
  label: string;
  href: string;
  icon: GrowvaultIconName;
}>;

export const HOMEPAGE_USP_ICONS = [
  {
    label: "Setup-Konfigurator",
    icon: "configurator",
    copy: "Passende Komponenten schneller kombinieren.",
  },
  {
    label: "Pflanzenanalyse",
    icon: "analyzer",
    copy: "Symptome prüfen und nächste Schritte sehen.",
  },
  {
    label: "Kuratierte Auswahl",
    icon: "shield",
    copy: "Weniger Sortimentslärm, klarere Entscheidungen.",
  },
  {
    label: "Schnelle Lieferung",
    icon: "truck",
    copy: "Versand ab 69 € in Deutschland frei.",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  icon: GrowvaultIconName;
  copy: string;
}>;

export const ANALYZER_PROCESS_ICONS = [
  { label: "Foto hochladen", icon: "analyzer" },
  { label: "Symptome erkennen", icon: "sensor" },
  { label: "Ursache eingrenzen", icon: "gauge" },
  { label: "Passende Produkte finden", icon: "cart" },
] as const satisfies ReadonlyArray<{
  label: string;
  icon: GrowvaultIconName;
}>;

export const FOOTER_TRUST_ICONS = [
  { label: "Kostenloser Versand ab 69 €", icon: "truck" },
  { label: "Sichere Zahlung", icon: "shield" },
  { label: "Starke Produktauswahl", icon: "check" },
  { label: "Stelle dir dein Setup zusammen", icon: "book" },
] as const satisfies ReadonlyArray<{
  label: string;
  icon: GrowvaultIconName;
}>;

export const PRIMARY_PATH_ICON_BY_TITLE = {
  Produkte: "package",
  "Setup-Konfigurator": "configurator",
  "Pflanzen-Analyzer": "analyzer",
  Bestseller: "sparkles",
  Neuheiten: "sprout",
  Ratgeber: "book",
} as const satisfies Record<string, GrowvaultIconName>;
export const NAV_ICON_BY_KEY = {
  products: "package",
  configurator: "configurator",
  analyzer: "analyzer",
  guides: "book",
  cart: "cart",
} as const satisfies Record<string, GrowvaultIconName>;
