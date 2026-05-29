import { prisma } from "@/lib/prisma";
import type {
  CustomizerCategoryHandle,
  CustomizerOption,
} from "@/lib/customizerCatalog";
import { getCustomizerFootprintKey } from "@/lib/customizerCompatibility";

export type SetupComponentProfileRecord = {
  variantId?: string;
  slot: "size" | "light" | "vent" | "extras";
  key?: string;
  footprintKey?: string | null;
  diameterMm?: number | null;
  diameterOptionsMm: number[];
  requiresCompleteSet: boolean;
  powerWatts?: number | null;
  noiseDb?: number | null;
  compatibilityTags: string[];
  matchTerms: string[];
  source: "db" | "derived";
};

const CATEGORY_SLOT_MAP: Record<
  CustomizerCategoryHandle,
  Pick<SetupComponentProfileRecord, "slot" | "key">
> = {
  zelte: { slot: "size" },
  licht: { slot: "light" },
  luft: { slot: "vent" },
  bewaesserung: { slot: "extras", key: "bewaesserung" },
  anzucht: { slot: "extras", key: "anzucht" },
};

const normalizeStoredSlot = (value: string): SetupComponentProfileRecord["slot"] => {
  switch (value) {
    case "SIZE":
      return "size";
    case "LIGHT":
      return "light";
    case "VENT":
      return "vent";
    default:
      return "extras";
  }
};

const extractNumber = (value: string, pattern: RegExp) => {
  const match = value.match(pattern);
  if (!match) return null;
  const parsed = Number(match[1]?.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const buildDerivedProfile = (
  option: CustomizerOption,
  category: CustomizerCategoryHandle,
): SetupComponentProfileRecord => {
  const slotInfo = CATEGORY_SLOT_MAP[category];
  const label = option.label ?? "";
  const normalizedLabel = label.toLowerCase();
  const footprintKey = getCustomizerFootprintKey(option.size ?? option.label);
  const diameterOptionsMm = option.diametersMm?.filter(Boolean) ?? [];
  const powerWatts = extractNumber(normalizedLabel, /(\d{2,4})\s*w/);
  const noiseDb = extractNumber(normalizedLabel, /(\d{1,3}(?:[.,]\d+)?)\s*d(?:b|ba)/);

  return {
    variantId: option.variantId,
    slot: slotInfo.slot,
    key: slotInfo.key,
    footprintKey,
    diameterMm: option.diameterMm ?? diameterOptionsMm[0] ?? null,
    diameterOptionsMm,
    requiresCompleteSet: Boolean(option.isSet),
    powerWatts,
    noiseDb,
    compatibilityTags: [
      slotInfo.slot,
      ...(slotInfo.key ? [slotInfo.key] : []),
      ...(footprintKey ? [footprintKey] : []),
      ...diameterOptionsMm.map((value) => `${value}mm`),
    ],
    matchTerms: [label, option.size ?? "", ...(footprintKey ? [footprintKey] : [])]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
    source: "derived",
  };
};

export async function buildResolvedSetupComponentProfiles(
  catalog: Partial<Record<CustomizerCategoryHandle, CustomizerOption[]>>,
) {
  const variantIds = Array.from(
    new Set(
      Object.values(catalog)
        .flatMap((options) => options ?? [])
        .map((option) => option.variantId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const records = variantIds.length
    ? await prisma.setupComponentProfile.findMany({
        where: { variantId: { in: variantIds } },
      })
    : [];
  const recordByVariantId = new Map(records.map((record) => [record.variantId, record]));
  const resolved = new Map<string, SetupComponentProfileRecord>();

  for (const [category, options] of Object.entries(catalog) as Array<
    [CustomizerCategoryHandle, CustomizerOption[] | undefined]
  >) {
    for (const option of options ?? []) {
      if (!option.variantId) continue;

      const stored = recordByVariantId.get(option.variantId);
      if (stored) {
        resolved.set(option.variantId, {
          variantId: stored.variantId,
          slot: normalizeStoredSlot(stored.slot),
          key: stored.key ?? undefined,
          footprintKey: stored.footprintKey,
          diameterMm: stored.diameterMm,
          diameterOptionsMm: [...stored.diameterOptionsMm],
          requiresCompleteSet: stored.requiresCompleteSet,
          powerWatts: stored.powerWatts,
          noiseDb: stored.noiseDb,
          compatibilityTags: [...stored.compatibilityTags],
          matchTerms: [...stored.matchTerms],
          source: "db",
        });
        continue;
      }

      resolved.set(option.variantId, buildDerivedProfile(option, category));
    }
  }

  return resolved;
}
