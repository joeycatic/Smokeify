import type {
  CustomizerOption,
  CustomizerCategoryHandle,
} from "@/lib/customizerCatalog";
import {
  CUSTOMIZER_CATEGORY_HANDLES,
  getCustomizerOptionsByCategory,
} from "@/lib/customizerCatalog";
import {
  getCustomizerFootprintKey,
  isLightOptionCompatibleWithTent,
  isVentOptionCompatibleWithTent,
  parseCustomizerSize,
} from "@/lib/customizerCompatibility";
import { getCustomizerPreset } from "@/lib/customizerPresets";
import { getDbCustomizerPresetDefinition } from "@/lib/customizerPresetStore";
import {
  buildResolvedSetupComponentProfiles,
  type SetupComponentProfileRecord,
} from "@/lib/setupComponentProfiles";
import type {
  CustomizerPresetDefinition,
  CustomizerPresetResolution,
  CustomizerPresetResolvedItem,
  CustomizerPresetSizeKey,
  CustomizerPresetSlot,
  PresetDiameterBias,
  PresetPriceBias,
  PresetRule,
} from "@/lib/customizerPresetTypes";

type CustomizerCatalogRecord = Record<string, CustomizerOption[]>;

const SLOT_LABELS: Record<CustomizerPresetSlot, string> = {
  size: "Zelt",
  light: "Licht",
  vent: "Abluft",
  extras: "Extras",
};

const PRICE_BIAS_SCORE: Record<PresetPriceBias, number> = {
  budget: -1,
  balanced: 0,
  premium: 1,
};

function scorePrice(price: number, bias: PresetPriceBias | undefined) {
  if (!Number.isFinite(price)) return 0;
  const normalized = Math.round(price * 10);
  return normalized * (PRICE_BIAS_SCORE[bias ?? "balanced"] * 0.01);
}

function scoreKeywords(label: string, rule: PresetRule) {
  const normalized = label.toLowerCase();
  let score = 0;

  rule.preferredKeywords?.forEach((keyword, index) => {
    if (normalized.includes(keyword.toLowerCase())) {
      score += 40 - index;
    }
  });

  rule.avoidKeywords?.forEach((keyword) => {
    if (normalized.includes(keyword.toLowerCase())) {
      score -= 120;
    }
  });

  return score;
}

function scoreProfileTerms(
  profile: SetupComponentProfileRecord | undefined,
  rule: PresetRule,
) {
  if (!profile) return 0;
  return scoreKeywords(
    [...profile.compatibilityTags, ...profile.matchTerms].join(" "),
    rule,
  );
}

function scoreDiameter(
  diameterMm: number | undefined,
  preferredDiameter: PresetDiameterBias | undefined,
) {
  if (!diameterMm) return 0;
  if (preferredDiameter === "largest") return diameterMm;
  if (preferredDiameter === "smallest") return -diameterMm;
  return 0;
}

function sortCandidates(
  candidates: Array<{ option: CustomizerOption; score: number }>,
) {
  return [...candidates].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if ((a.option.outOfStock ?? false) !== (b.option.outOfStock ?? false)) {
      return a.option.outOfStock ? 1 : -1;
    }
    return a.option.price - b.option.price;
  });
}

function toResolvedItem(
  option: CustomizerOption,
  slot: CustomizerPresetSlot,
  reason: string,
  reasonLabels: string[],
  matchType: "exact" | "fallback" = "exact",
): CustomizerPresetResolvedItem {
  if (!option.variantId) {
    throw new Error(`Missing variant for preset ${slot} option ${option.label}.`);
  }

  return {
    ...option,
    slot,
    slotLabel: SLOT_LABELS[slot],
    optionId: option.id,
    variantId: option.variantId,
    reason,
    reasonLabels,
    matchType,
  };
}

function getSupportedSizeKey(
  definition: CustomizerPresetDefinition,
  requested?: string | null,
) {
  const normalized = requested?.trim().toLowerCase() ?? "";
  const match = definition.supportedSizeKeys.find((sizeKey) => sizeKey === normalized);
  return match ?? definition.defaultSizeKey;
}

function pickTentOption(
  tentOptions: CustomizerOption[],
  sizeKey: CustomizerPresetSizeKey,
  rule: PresetRule,
  profiles?: Map<string, SetupComponentProfileRecord>,
) {
  const candidates = tentOptions
    .filter((option) => !option.outOfStock)
    .filter((option) => !option.isSet)
    .filter((option) => {
      const profile = option.variantId ? profiles?.get(option.variantId) : undefined;
      return (profile?.footprintKey ?? getCustomizerFootprintKey(option.size ?? option.label)) === sizeKey;
    })
    .map((option) => {
      const profile = option.variantId ? profiles?.get(option.variantId) : undefined;
      const parsed = parseCustomizerSize(option.size ?? option.label);
      const heightScore = parsed?.height ?? 0;
      return {
        option,
        score:
          400 +
          scoreKeywords(option.label, rule) +
          scoreProfileTerms(profile, rule) +
          scorePrice(option.price, rule.priceBias) +
          heightScore * (rule.priceBias === "premium" ? 0.2 : 0.05) +
          scoreDiameter(
            profile?.diameterMm ?? Math.max(...(option.diametersMm ?? [0])),
            rule.preferredDiameter,
          ),
      };
    });

  return sortCandidates(candidates)[0]?.option ?? null;
}

function pickLightOption(
  lightOptions: CustomizerOption[],
  tentOption: CustomizerOption,
  targetSizeKey: CustomizerPresetSizeKey,
  rule: PresetRule,
  profiles?: Map<string, SetupComponentProfileRecord>,
) {
  const exactCandidates = lightOptions
    .filter((option) => !option.outOfStock)
    .filter((option) =>
      isLightOptionCompatibleWithTent(tentOption.size ?? tentOption.label, option),
    )
    .map((option) => {
      const profile = option.variantId ? profiles?.get(option.variantId) : undefined;
      const optionSizeKey =
        profile?.footprintKey ?? getCustomizerFootprintKey(option.size ?? option.label);
      const exactMatch = optionSizeKey === targetSizeKey;
      return {
        option,
        score:
          (exactMatch ? 320 : 160) +
          scoreKeywords(option.label, rule) +
          scoreProfileTerms(profile, rule) +
          scorePrice(option.price, rule.priceBias),
      };
    });

  return sortCandidates(exactCandidates)[0]?.option ?? null;
}

function pickVentOption(
  ventOptions: CustomizerOption[],
  tentOption: CustomizerOption,
  rule: PresetRule,
  profiles?: Map<string, SetupComponentProfileRecord>,
) {
  const exactCandidates = ventOptions
    .filter((option) => !option.outOfStock)
    .filter((option) => isVentOptionCompatibleWithTent(tentOption.diametersMm, option))
    .filter((option) => {
      const profile = option.variantId ? profiles?.get(option.variantId) : undefined;
      return rule.requireSet ? (profile?.requiresCompleteSet ?? option.isSet ?? false) : true;
    })
    .map((option) => {
      const profile = option.variantId ? profiles?.get(option.variantId) : undefined;
      return {
        option,
        score:
          280 +
          scoreKeywords(option.label, rule) +
          scoreProfileTerms(profile, rule) +
          scorePrice(option.price, rule.priceBias) +
          scoreDiameter(profile?.diameterMm ?? option.diameterMm, rule.preferredDiameter),
      };
    });

  const fallbackCandidates =
    exactCandidates.length > 0
      ? exactCandidates
      : ventOptions
          .filter((option) => !option.outOfStock)
          .filter((option) =>
            isVentOptionCompatibleWithTent(tentOption.diametersMm, option),
          )
          .map((option) => ({
            option,
            score:
              180 +
              scoreKeywords(option.label, rule) +
              scoreProfileTerms(
                option.variantId ? profiles?.get(option.variantId) : undefined,
                rule,
              ) +
              scorePrice(option.price, rule.priceBias) +
              scoreDiameter(
                (option.variantId ? profiles?.get(option.variantId) : undefined)?.diameterMm ??
                  option.diameterMm,
                rule.preferredDiameter,
              ),
          }));

  return sortCandidates(fallbackCandidates)[0]?.option ?? null;
}

function pickExtraOption(
  extraOptions: CustomizerOption[],
  rule: PresetRule,
  alreadySelectedIds: Set<string>,
  profiles?: Map<string, SetupComponentProfileRecord>,
) {
  const candidates = extraOptions
    .filter((option) => !option.outOfStock)
    .filter((option) => !alreadySelectedIds.has(option.id))
    .map((option) => ({
      option,
      score:
        140 +
        scoreKeywords(option.label, rule) +
        scoreProfileTerms(
          option.variantId ? profiles?.get(option.variantId) : undefined,
          rule,
        ) +
        scorePrice(option.price, rule.priceBias),
    }));

  return sortCandidates(candidates)[0]?.option ?? null;
}

function buildCartOptions(
  preset: CustomizerPresetDefinition,
  item: CustomizerPresetResolvedItem,
  selectedSizeKey: string,
) {
  return [
    { name: "Setup", value: preset.title },
    { name: "Preset", value: preset.slug },
    ...(preset.versionNumber
      ? [{ name: "Preset Version", value: String(preset.versionNumber) }]
      : []),
    ...(preset.versionId ? [{ name: "Preset Version Id", value: preset.versionId }] : []),
    { name: "Preset Size", value: selectedSizeKey },
    { name: "Preset Slot", value: item.slot },
    ...(item.reasonLabels.length > 0
      ? [{ name: "Preset Labels", value: item.reasonLabels.join(" | ") }]
      : []),
  ];
}

export function resolveCustomizerPresetFromCatalog(params: {
  slug: string;
  sizeKey?: string | null;
  catalog: CustomizerCatalogRecord;
}) {
  const preset = getCustomizerPreset(params.slug);
  if (!preset) {
    throw new Error("Preset not found.");
  }

  const selectedSizeKey = getSupportedSizeKey(preset, params.sizeKey);
  const tentOptions = params.catalog.zelte ?? [];
  const lightOptions = params.catalog.licht ?? [];
  const ventOptions = params.catalog.luft ?? [];
  const extraOptions = [
    ...(params.catalog.bewaesserung ?? []),
    ...(params.catalog.anzucht ?? []),
  ];

  const sizeOption = pickTentOption(tentOptions, selectedSizeKey, preset.selection.size);
  if (!sizeOption) {
    throw new Error("Kein passendes Zelt für dieses Preset gefunden.");
  }

  const lightOption = pickLightOption(
    lightOptions,
    sizeOption,
    selectedSizeKey,
    preset.selection.light,
  );
  if (!lightOption) {
    throw new Error("Kein passendes Licht für dieses Preset gefunden.");
  }

  const ventOption = pickVentOption(ventOptions, sizeOption, preset.selection.vent);
  if (!ventOption) {
    throw new Error("Keine passende Abluft für dieses Preset gefunden.");
  }

  const selectedExtras = new Set<string>();
  const extras = preset.selection.extras
    .map((rule) => {
      const option = pickExtraOption(extraOptions, rule, selectedExtras);
      if (!option) return null;
      selectedExtras.add(option.id);
      return toResolvedItem(option, "extras", rule.reason, [...rule.reasonLabels]);
    })
    .filter((item): item is CustomizerPresetResolvedItem => Boolean(item));

  const resolvedSize = toResolvedItem(
    sizeOption,
    "size",
    preset.selection.size.reason,
    [...preset.selection.size.reasonLabels],
  );
  const resolvedLight = toResolvedItem(
    lightOption,
    "light",
    preset.selection.light.reason,
    [...preset.selection.light.reasonLabels],
    getCustomizerFootprintKey(lightOption.size ?? lightOption.label) === selectedSizeKey
      ? "exact"
      : "fallback",
  );
  const resolvedVent = toResolvedItem(
    ventOption,
    "vent",
    preset.selection.vent.reason,
    [...preset.selection.vent.reasonLabels],
  );

  const items = [resolvedSize, resolvedLight, resolvedVent, ...extras];
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return {
    preset: {
      slug: preset.slug,
      versionId: preset.versionId,
      versionNumber: preset.versionNumber,
      title: preset.title,
      summary: preset.summary,
      description: preset.description,
      explainer: preset.explainer,
      reasonLabels: [...preset.reasonLabels],
      supportedSizeKeys: [...preset.supportedSizeKeys],
      selectedSizeKey,
    },
    total,
    selectedIds: {
      sizeId: resolvedSize.optionId,
      lightIds: [resolvedLight.optionId],
      ventIds: [resolvedVent.optionId],
      extras: extras.map((item) => item.optionId),
    },
    slots: {
      size: resolvedSize,
      light: [resolvedLight],
      vent: [resolvedVent],
      extras,
    },
    cartItems: items.map((item) => ({
      variantId: item.variantId,
      quantity: 1,
      options: buildCartOptions(preset, item, selectedSizeKey),
    })),
  } satisfies CustomizerPresetResolution;
}

async function resolvePresetFromCatalogDefinition(params: {
  preset: CustomizerPresetDefinition;
  sizeKey?: string | null;
  catalog: CustomizerCatalogRecord;
}) {
  const selectedSizeKey = getSupportedSizeKey(params.preset, params.sizeKey);
  const tentOptions = params.catalog.zelte ?? [];
  const lightOptions = params.catalog.licht ?? [];
  const ventOptions = params.catalog.luft ?? [];
  const extraOptions = [
    ...(params.catalog.bewaesserung ?? []),
    ...(params.catalog.anzucht ?? []),
  ];
  const profiles = await buildResolvedSetupComponentProfiles(params.catalog);

  const sizeOption = pickTentOption(
    tentOptions,
    selectedSizeKey,
    params.preset.selection.size,
    profiles,
  );
  if (!sizeOption) {
    throw new Error("Kein passendes Zelt für dieses Preset gefunden.");
  }

  const lightOption = pickLightOption(
    lightOptions,
    sizeOption,
    selectedSizeKey,
    params.preset.selection.light,
    profiles,
  );
  if (!lightOption) {
    throw new Error("Kein passendes Licht für dieses Preset gefunden.");
  }

  const ventOption = pickVentOption(
    ventOptions,
    sizeOption,
    params.preset.selection.vent,
    profiles,
  );
  if (!ventOption) {
    throw new Error("Keine passende Abluft für dieses Preset gefunden.");
  }

  const selectedExtras = new Set<string>();
  const extras = params.preset.selection.extras
    .map((rule) => {
      const option = pickExtraOption(extraOptions, rule, selectedExtras, profiles);
      if (!option) return null;
      selectedExtras.add(option.id);
      return toResolvedItem(option, "extras", rule.reason, [...rule.reasonLabels]);
    })
    .filter((item): item is CustomizerPresetResolvedItem => Boolean(item));

  const resolvedSize = toResolvedItem(
    sizeOption,
    "size",
    params.preset.selection.size.reason,
    [...params.preset.selection.size.reasonLabels],
  );
  const resolvedLight = toResolvedItem(
    lightOption,
    "light",
    params.preset.selection.light.reason,
    [...params.preset.selection.light.reasonLabels],
    getCustomizerFootprintKey(lightOption.size ?? lightOption.label) === selectedSizeKey
      ? "exact"
      : "fallback",
  );
  const resolvedVent = toResolvedItem(
    ventOption,
    "vent",
    params.preset.selection.vent.reason,
    [...params.preset.selection.vent.reasonLabels],
  );

  const items = [resolvedSize, resolvedLight, resolvedVent, ...extras];
  const total = items.reduce((sum, item) => sum + item.price, 0);

  return {
    preset: {
      slug: params.preset.slug,
      versionId: params.preset.versionId,
      versionNumber: params.preset.versionNumber,
      title: params.preset.title,
      summary: params.preset.summary,
      description: params.preset.description,
      explainer: params.preset.explainer,
      reasonLabels: [...params.preset.reasonLabels],
      supportedSizeKeys: [...params.preset.supportedSizeKeys],
      selectedSizeKey,
    },
    total,
    selectedIds: {
      sizeId: resolvedSize.optionId,
      lightIds: [resolvedLight.optionId],
      ventIds: [resolvedVent.optionId],
      extras: extras.map((item) => item.optionId),
    },
    slots: {
      size: resolvedSize,
      light: [resolvedLight],
      vent: [resolvedVent],
      extras,
    },
    cartItems: items.map((item) => ({
      variantId: item.variantId,
      quantity: 1,
      options: buildCartOptions(params.preset, item, selectedSizeKey),
    })),
  } satisfies CustomizerPresetResolution;
}

export async function resolveCustomizerPreset(params: {
  slug: string;
  sizeKey?: string | null;
  categories?: readonly CustomizerCategoryHandle[];
}) {
  const preset = await getDbCustomizerPresetDefinition(params.slug);
  if (!preset) {
    throw new Error("Preset not found.");
  }
  const catalog = await getCustomizerOptionsByCategory(
    params.categories ?? CUSTOMIZER_CATEGORY_HANDLES,
  );
  return resolvePresetFromCatalogDefinition({
    preset,
    sizeKey: params.sizeKey,
    catalog,
  });
}

