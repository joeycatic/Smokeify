type ListingQuickPickKey =
  | "beginner"
  | "budget"
  | "compact"
  | "quiet"
  | "premium";

export type ListingQuickPickChip = {
  id: ListingQuickPickKey;
  label: string;
  detail: string;
  searchQuery: string;
};

export type BuildListingQuickPicksInput = {
  categoryHandle?: string;
  categoryTitle?: string;
};

export type BuildListingResultSummaryInput = {
  total: number;
  categoryTitle?: string;
  searchQuery?: string;
  manufacturers?: string[];
  activeFilterCount?: number;
};

const DEFAULT_CHIPS: ListingQuickPickChip[] = [
  {
    id: "beginner",
    label: "Einsteiger",
    detail: "Weniger Overkill, klarer Start",
    searchQuery: "starter",
  },
  {
    id: "budget",
    label: "Budget",
    detail: "Preis zuerst",
    searchQuery: "budget",
  },
  {
    id: "compact",
    label: "Kompakt",
    detail: "Für kleinere Flächen",
    searchQuery: "kompakt",
  },
  {
    id: "quiet",
    label: "Leise",
    detail: "Weniger Betriebsgeräusch",
    searchQuery: "leise",
  },
  {
    id: "premium",
    label: "Premium",
    detail: "Mehr Reserve und Qualität",
    searchQuery: "premium",
  },
];

const CATEGORY_CHIP_ORDER: Record<string, ListingQuickPickKey[]> = {
  tents: ["beginner", "budget", "compact", "premium"],
  lighting: ["beginner", "compact", "budget", "premium"],
  ventilation: ["quiet", "budget", "premium", "compact"],
  nutrients: ["beginner", "budget", "premium"],
};

function normalizeCategory(handle?: string) {
  const value = handle?.toLowerCase() ?? "";
  if (
    value.includes("zelt") ||
    value.includes("tent") ||
    value.includes("growbox")
  ) {
    return "tents";
  }
  if (
    value.includes("licht") ||
    value.includes("led") ||
    value.includes("lamp")
  ) {
    return "lighting";
  }
  if (
    value.includes("luft") ||
    value.includes("vent") ||
    value.includes("filter")
  ) {
    return "ventilation";
  }
  if (
    value.includes("dung") ||
    value.includes("substrat") ||
    value.includes("nutr")
  ) {
    return "nutrients";
  }
  return "default";
}

export function buildListingQuickPickChips({
  categoryHandle,
}: BuildListingQuickPicksInput): ListingQuickPickChip[] {
  const categoryKey = normalizeCategory(categoryHandle);
  const order = CATEGORY_CHIP_ORDER[categoryKey] ?? DEFAULT_CHIPS.map((chip) => chip.id);
  const chipsById = new Map(DEFAULT_CHIPS.map((chip) => [chip.id, chip]));

  return order
    .map((id) => chipsById.get(id))
    .filter((chip): chip is ListingQuickPickChip => Boolean(chip))
    .slice(0, 5);
}

export function buildListingResultSummary({
  total,
  categoryTitle,
  searchQuery,
  manufacturers = [],
  activeFilterCount = 0,
}: BuildListingResultSummaryInput) {
  const segments: string[] = [];
  const safeSearch = searchQuery?.trim();

  if (categoryTitle) {
    segments.push(`für ${categoryTitle}`);
  } else {
    segments.push("im Katalog");
  }

  if (safeSearch) {
    segments.push(`mit Suche nach "${safeSearch}"`);
  }

  if (manufacturers.length === 1) {
    segments.push(`mit Hersteller ${manufacturers[0]}`);
  } else if (manufacturers.length > 1) {
    segments.push(`mit ${manufacturers.length} Herstellern`);
  }

  if (activeFilterCount > 0) {
    segments.push(`${activeFilterCount} aktive Filter`);
  }

  return `${total} Treffer ${segments.join(" · ")}`;
}

