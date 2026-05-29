export type CustomizerOptionLike = {
  size?: string | null;
  label?: string | null;
  diameterMm?: number | null;
};

export function parseCustomizerSize(value?: string | null) {
  if (!value) return null;
  const matches = value.match(/(\d+(?:[.,]\d+)?)/g);
  if (!matches || matches.length < 2) return null;
  const numbers = matches
    .map((match) => Number(match.replace(",", ".")))
    .filter((num) => Number.isFinite(num));
  if (numbers.length < 2) return null;
  return { width: numbers[0], depth: numbers[1], height: numbers[2] ?? null };
}

export function compareCustomizerSizes(a?: string | null, b?: string | null) {
  const aSize = parseCustomizerSize(a);
  const bSize = parseCustomizerSize(b);
  if (aSize && bSize) {
    if (aSize.width !== bSize.width) return aSize.width - bSize.width;
    if (aSize.depth !== bSize.depth) return aSize.depth - bSize.depth;
    if ((aSize.height ?? 0) !== (bSize.height ?? 0)) {
      return (aSize.height ?? 0) - (bSize.height ?? 0);
    }
    return 0;
  }
  if (aSize && !bSize) return -1;
  if (!aSize && bSize) return 1;
  return (a ?? "").localeCompare(b ?? "");
}

export function getCustomizerSizeKey(value?: string | null) {
  const parsed = parseCustomizerSize(value);
  if (!parsed) return null;
  const base = `${parsed.width}x${parsed.depth}`;
  return parsed.height ? `${base}x${parsed.height}` : base;
}

export function getCustomizerFootprintKey(value?: string | null) {
  const parsed = parseCustomizerSize(value);
  if (!parsed) return null;
  return `${parsed.width}x${parsed.depth}`;
}

export function isLightOptionCompatibleWithTent(
  tentValue: string | null | undefined,
  option: CustomizerOptionLike,
) {
  const tentSize = parseCustomizerSize(tentValue);
  if (!tentSize) return true;
  const optionSize = parseCustomizerSize(option.size ?? option.label);
  if (!optionSize) return true;
  return (
    optionSize.width <= tentSize.width && optionSize.depth <= tentSize.depth
  );
}

export function isVentOptionCompatibleWithTent(
  tentDiametersMm: number[] | null | undefined,
  option: CustomizerOptionLike,
) {
  if (!tentDiametersMm?.length) return true;
  if (!option.diameterMm) return true;
  return tentDiametersMm.includes(option.diameterMm);
}

export type SavedSetupSnapshotItem = {
  slot: "size" | "light" | "vent" | "extras";
  optionId?: string;
  variantId?: string;
  title?: string;
  reason?: string;
  reasonLabels?: string[];
};

export type SavedSetupPriceSnapshot = {
  currency: "EUR";
  totalCents: number;
  items: Array<{
    variantId: string;
    label: string;
    slot: SavedSetupSnapshotItem["slot"];
    priceCents: number;
  }>;
};

export type SavedSetupData = {
  schemaVersion?: 1 | 2;
  sizeId?: string;
  lightId?: string[] | string;
  ventId?: string[] | string;
  extras?: string[] | string;
  sizeVariantId?: string;
  lightVariantIds?: string[] | string;
  ventVariantIds?: string[] | string;
  extraVariantIds?: string[] | string;
  presetSlug?: string;
  presetVersionId?: string;
  presetVersionNumber?: number;
  presetSizeKey?: string;
  presetTitle?: string;
  selectionSummary?: Record<string, unknown>;
  source?: string;
  presetSnapshot?: SavedSetupSnapshotItem[];
  selectedLabels?: Record<string, string[]>;
  savedPriceSnapshot?: SavedSetupPriceSnapshot;
  componentSlots?: Array<{
    slot: SavedSetupSnapshotItem["slot"];
    optionId?: string;
    variantId?: string;
    label?: string;
  }>;
};

export function buildSavedSetupHref(data?: SavedSetupData) {
  const normalize = (value?: string[] | string) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value].filter(Boolean);
  };

  const params = new URLSearchParams();
  if (data?.presetSlug) params.set("preset", data.presetSlug);
  if (data?.presetSizeKey) params.set("size", data.presetSizeKey);
  if (data?.sizeId) params.set("sizeId", data.sizeId);
  const lightIds = normalize(data?.lightId);
  if (lightIds.length > 0) params.set("lightId", lightIds.join(","));
  const ventIds = normalize(data?.ventId);
  if (ventIds.length > 0) params.set("ventId", ventIds.join(","));
  const extras = normalize(data?.extras);
  if (extras.length > 0) params.set("extras", extras.join(","));
  const query = params.toString();
  return query ? `/customizer?${query}` : "/customizer";
}

export function buildSetupCartItems(data?: SavedSetupData) {
  const normalize = (value?: string[] | string) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value].filter(Boolean);
  };

  const setupLabel = data?.presetTitle ?? "Saved setup";
  const presetItemMap = new Map(
    (data?.presetSnapshot ?? [])
      .filter((item) => item.variantId)
      .map((item) => [item.variantId as string, item]),
  );
  const variantIds = [
    ...(data?.sizeVariantId ? [data.sizeVariantId] : []),
    ...normalize(data?.lightVariantIds),
    ...normalize(data?.ventVariantIds),
    ...normalize(data?.extraVariantIds),
  ];

  return variantIds.map((variantId) => {
    const snapshot = presetItemMap.get(variantId);
    const options = [
      { name: "Setup", value: setupLabel },
      ...(data?.presetSlug ? [{ name: "Preset", value: data.presetSlug }] : []),
      ...(data?.presetVersionNumber
        ? [{ name: "Preset Version", value: String(data.presetVersionNumber) }]
        : []),
      ...(data?.presetVersionId
        ? [{ name: "Preset Version Id", value: data.presetVersionId }]
        : []),
      ...(snapshot?.slot ? [{ name: "Preset Slot", value: snapshot.slot }] : []),
    ];

    return {
      variantId,
      quantity: 1,
      options,
    };
  });
}

