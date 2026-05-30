import type { CustomizerOption } from "@/lib/customizerCatalog";

export type CustomizerPresetSlug =
  | "beginner"
  | "compact"
  | "silent"
  | "budget"
  | "premium-yield";

export type CustomizerPresetSizeKey = "60x60" | "80x80" | "100x100" | "120x120";

export type CustomizerPresetSlot = "size" | "light" | "vent" | "extras";

export type PresetPriceBias = "budget" | "balanced" | "premium";
export type PresetDiameterBias = "smallest" | "largest";

export type PresetRule = {
  reason: string;
  reasonLabels: string[];
  preferredKeywords?: readonly string[];
  avoidKeywords?: readonly string[];
  priceBias?: PresetPriceBias;
  requireSet?: boolean;
  preferredDiameter?: PresetDiameterBias;
};

export type PresetExtraRule = PresetRule & {
  key: string;
};

export type CustomizerPresetDefinition = {
  slug: CustomizerPresetSlug;
  versionId?: string;
  versionNumber?: number;
  title: string;
  summary: string;
  description: string;
  supportedSizeKeys: readonly CustomizerPresetSizeKey[];
  defaultSizeKey: CustomizerPresetSizeKey;
  reasonLabels: readonly string[];
  explainer: string;
  selection: {
    size: PresetRule;
    light: PresetRule;
    vent: PresetRule;
    extras: readonly PresetExtraRule[];
  };
};

export type CustomizerPresetSelection = {
  sizeId?: string;
  lightIds: string[];
  ventIds: string[];
  extras: string[];
};

export type CustomizerPresetResolvedItem = CustomizerOption & {
  slot: CustomizerPresetSlot;
  slotLabel: string;
  optionId: string;
  variantId: string;
  reason: string;
  reasonLabels: string[];
  matchType: "exact" | "fallback";
};

export type CustomizerPresetResolution = {
  preset: {
    slug: CustomizerPresetSlug;
    versionId?: string;
    versionNumber?: number;
    title: string;
    summary: string;
    description: string;
    explainer: string;
    reasonLabels: string[];
    supportedSizeKeys: CustomizerPresetSizeKey[];
    selectedSizeKey: CustomizerPresetSizeKey;
  };
  total: number;
  selectedIds: CustomizerPresetSelection;
  slots: {
    size: CustomizerPresetResolvedItem | null;
    light: CustomizerPresetResolvedItem[];
    vent: CustomizerPresetResolvedItem[];
    extras: CustomizerPresetResolvedItem[];
  };
  cartItems: Array<{
    variantId: string;
    quantity: number;
    options: Array<{ name: string; value: string }>;
  }>;
};

