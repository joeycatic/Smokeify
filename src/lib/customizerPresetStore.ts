import type {
  CustomizerPresetDefinition,
  CustomizerPresetSizeKey,
  PresetDiameterBias,
  PresetPriceBias,
  PresetRule,
} from "@/lib/customizerPresetTypes";
import { CUSTOMIZER_PRESETS, getCustomizerPreset } from "@/lib/customizerPresets";
import { prisma } from "@/lib/prisma";

const toDbPriceBias = (value: PresetPriceBias | undefined) =>
  value ? value.toUpperCase() : "BALANCED";

const toDbDiameterBias = (value: PresetDiameterBias | undefined) =>
  value ? value.toUpperCase() : null;

const fromDbPriceBias = (value: string): PresetPriceBias =>
  value.toLowerCase() as PresetPriceBias;

const fromDbDiameterBias = (value?: string | null): PresetDiameterBias | undefined =>
  value ? (value.toLowerCase() as PresetDiameterBias) : undefined;

function toRuleRecord(rule: {
  reason: string;
  reasonLabels: readonly string[];
  preferredKeywords?: readonly string[];
  avoidKeywords?: readonly string[];
  priceBias?: PresetPriceBias;
  requireSet?: boolean;
  preferredDiameter?: PresetDiameterBias;
}): Omit<PresetRule, "reasonLabels"> & { reasonLabels: string[] } {
  return {
    reason: rule.reason,
    reasonLabels: [...rule.reasonLabels],
    preferredKeywords: [...(rule.preferredKeywords ?? [])],
    avoidKeywords: [...(rule.avoidKeywords ?? [])],
    priceBias: rule.priceBias,
    requireSet: rule.requireSet,
    preferredDiameter: rule.preferredDiameter,
  };
}

const buildPresetDefinitionSnapshot = (definition: CustomizerPresetDefinition) => ({
  slug: definition.slug,
  title: definition.title,
  summary: definition.summary,
  description: definition.description,
  explainer: definition.explainer,
  supportedSizeKeys: [...definition.supportedSizeKeys],
  defaultSizeKey: definition.defaultSizeKey,
  reasonLabels: [...definition.reasonLabels],
  selection: {
    size: toRuleRecord(definition.selection.size),
    light: toRuleRecord(definition.selection.light),
    vent: toRuleRecord(definition.selection.vent),
    extras: definition.selection.extras.map((rule) => ({
      key: rule.key,
      ...toRuleRecord(rule),
    })),
  },
});

async function ensureCustomizerPresetVersion(
  presetId: string,
  definition: CustomizerPresetDefinition,
) {
  const existing = await prisma.customizerPresetVersion.findFirst({
    where: { presetId },
    orderBy: { version: "desc" },
    select: { id: true, version: true },
  });
  if (existing) return existing;

  return prisma.customizerPresetVersion.create({
    data: {
      presetId,
      version: 1,
      title: definition.title,
      summary: definition.summary,
      description: definition.description,
      explainer: definition.explainer,
      supportedSizeKeys: [...definition.supportedSizeKeys],
      defaultSizeKey: definition.defaultSizeKey,
      reasonLabels: [...definition.reasonLabels],
      definition: buildPresetDefinitionSnapshot(definition),
      isPublished: true,
      publishedAt: new Date(),
    },
    select: { id: true, version: true },
  });
}

export async function ensureCustomizerPresetsSeeded() {
  let count = 0;
  try {
    count = await prisma.customizerPreset.count();
  } catch {
    return false;
  }
  if (count > 0) return true;

  for (const seed of CUSTOMIZER_PRESETS) {
    const preset = await prisma.customizerPreset.create({
      data: {
        slug: seed.slug,
        title: seed.title,
        summary: seed.summary,
        description: seed.description,
        explainer: seed.explainer,
        supportedSizeKeys: [...seed.supportedSizeKeys],
        defaultSizeKey: seed.defaultSizeKey,
        reasonLabels: [...seed.reasonLabels],
      },
    });

    await prisma.customizerPresetSlotRule.createMany({
      data: [
        {
          presetId: preset.id,
          slot: "SIZE",
          sortOrder: 0,
          reason: seed.selection.size.reason,
          reasonLabels: [...seed.selection.size.reasonLabels],
          preferredKeywords: [...(seed.selection.size.preferredKeywords ?? [])],
          avoidKeywords: [...(seed.selection.size.avoidKeywords ?? [])],
          priceBias: toDbPriceBias(seed.selection.size.priceBias) as "BUDGET" | "BALANCED" | "PREMIUM",
          requireSet: seed.selection.size.requireSet ?? false,
          preferredDiameter: toDbDiameterBias(seed.selection.size.preferredDiameter) as
            | "SMALLEST"
            | "LARGEST"
            | null,
        },
        {
          presetId: preset.id,
          slot: "LIGHT",
          sortOrder: 1,
          reason: seed.selection.light.reason,
          reasonLabels: [...seed.selection.light.reasonLabels],
          preferredKeywords: [...(seed.selection.light.preferredKeywords ?? [])],
          avoidKeywords: [...(seed.selection.light.avoidKeywords ?? [])],
          priceBias: toDbPriceBias(seed.selection.light.priceBias) as "BUDGET" | "BALANCED" | "PREMIUM",
          requireSet: seed.selection.light.requireSet ?? false,
          preferredDiameter: toDbDiameterBias(seed.selection.light.preferredDiameter) as
            | "SMALLEST"
            | "LARGEST"
            | null,
        },
        {
          presetId: preset.id,
          slot: "VENT",
          sortOrder: 2,
          reason: seed.selection.vent.reason,
          reasonLabels: [...seed.selection.vent.reasonLabels],
          preferredKeywords: [...(seed.selection.vent.preferredKeywords ?? [])],
          avoidKeywords: [...(seed.selection.vent.avoidKeywords ?? [])],
          priceBias: toDbPriceBias(seed.selection.vent.priceBias) as "BUDGET" | "BALANCED" | "PREMIUM",
          requireSet: seed.selection.vent.requireSet ?? false,
          preferredDiameter: toDbDiameterBias(seed.selection.vent.preferredDiameter) as
            | "SMALLEST"
            | "LARGEST"
            | null,
        },
      ],
    });

    await prisma.customizerPresetExtraRule.createMany({
      data: seed.selection.extras.map((extra, index) => ({
        presetId: preset.id,
        key: extra.key,
        sortOrder: index,
        reason: extra.reason,
        reasonLabels: [...extra.reasonLabels],
        preferredKeywords: [...(extra.preferredKeywords ?? [])],
        avoidKeywords: [...(extra.avoidKeywords ?? [])],
        priceBias: toDbPriceBias(extra.priceBias) as "BUDGET" | "BALANCED" | "PREMIUM",
        requireSet: extra.requireSet ?? false,
        preferredDiameter: toDbDiameterBias(extra.preferredDiameter) as
          | "SMALLEST"
          | "LARGEST"
          | null,
      })),
    });

    await ensureCustomizerPresetVersion(preset.id, seed);
  }

  return true;
}

export async function getDbCustomizerPresetDefinition(
  slug: string,
): Promise<CustomizerPresetDefinition | null> {
  const ready = await ensureCustomizerPresetsSeeded();
  if (!ready) {
    return getCustomizerPreset(slug);
  }

  const preset = await prisma.customizerPreset.findUnique({
    where: { slug },
    include: {
      versions: {
        where: { isPublished: true },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
      slotRules: {
        orderBy: { sortOrder: "asc" },
      },
      extraRules: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!preset || !preset.isActive) {
    return null;
  }

  const sizeRule = preset.slotRules.find((rule) => rule.slot === "SIZE");
  const lightRule = preset.slotRules.find((rule) => rule.slot === "LIGHT");
  const ventRule = preset.slotRules.find((rule) => rule.slot === "VENT");
  if (!sizeRule || !lightRule || !ventRule) {
    return null;
  }

  const publishedVersion =
    preset.versions[0] ??
    (await ensureCustomizerPresetVersion(preset.id, {
      slug: preset.slug as CustomizerPresetDefinition["slug"],
      title: preset.title,
      summary: preset.summary,
      description: preset.description,
      supportedSizeKeys: preset.supportedSizeKeys as CustomizerPresetSizeKey[],
      defaultSizeKey: preset.defaultSizeKey as CustomizerPresetSizeKey,
      reasonLabels: [...preset.reasonLabels],
      explainer: preset.explainer,
      selection: {
        size: toRuleRecord({
          reason: sizeRule.reason,
          reasonLabels: sizeRule.reasonLabels,
          preferredKeywords: sizeRule.preferredKeywords,
          avoidKeywords: sizeRule.avoidKeywords,
          priceBias: fromDbPriceBias(sizeRule.priceBias),
          requireSet: sizeRule.requireSet,
          preferredDiameter: fromDbDiameterBias(sizeRule.preferredDiameter),
        }),
        light: toRuleRecord({
          reason: lightRule.reason,
          reasonLabels: lightRule.reasonLabels,
          preferredKeywords: lightRule.preferredKeywords,
          avoidKeywords: lightRule.avoidKeywords,
          priceBias: fromDbPriceBias(lightRule.priceBias),
          requireSet: lightRule.requireSet,
          preferredDiameter: fromDbDiameterBias(lightRule.preferredDiameter),
        }),
        vent: toRuleRecord({
          reason: ventRule.reason,
          reasonLabels: ventRule.reasonLabels,
          preferredKeywords: ventRule.preferredKeywords,
          avoidKeywords: ventRule.avoidKeywords,
          priceBias: fromDbPriceBias(ventRule.priceBias),
          requireSet: ventRule.requireSet,
          preferredDiameter: fromDbDiameterBias(ventRule.preferredDiameter),
        }),
        extras: preset.extraRules.map((rule) => ({
          key: rule.key,
          ...toRuleRecord({
            reason: rule.reason,
            reasonLabels: rule.reasonLabels,
            preferredKeywords: rule.preferredKeywords,
            avoidKeywords: rule.avoidKeywords,
            priceBias: fromDbPriceBias(rule.priceBias),
            requireSet: rule.requireSet,
            preferredDiameter: fromDbDiameterBias(rule.preferredDiameter),
          }),
        })),
      },
    }));

  return {
    slug: preset.slug as CustomizerPresetDefinition["slug"],
    versionId: publishedVersion.id,
    versionNumber: publishedVersion.version,
    title: preset.title,
    summary: preset.summary,
    description: preset.description,
    supportedSizeKeys: preset.supportedSizeKeys as CustomizerPresetSizeKey[],
    defaultSizeKey: preset.defaultSizeKey as CustomizerPresetSizeKey,
    reasonLabels: [...preset.reasonLabels],
    explainer: preset.explainer,
    selection: {
      size: {
        reason: sizeRule.reason,
        reasonLabels: [...sizeRule.reasonLabels],
        preferredKeywords: [...sizeRule.preferredKeywords],
        avoidKeywords: [...sizeRule.avoidKeywords],
        priceBias: fromDbPriceBias(sizeRule.priceBias),
        requireSet: sizeRule.requireSet,
        preferredDiameter: fromDbDiameterBias(sizeRule.preferredDiameter),
      },
      light: {
        reason: lightRule.reason,
        reasonLabels: [...lightRule.reasonLabels],
        preferredKeywords: [...lightRule.preferredKeywords],
        avoidKeywords: [...lightRule.avoidKeywords],
        priceBias: fromDbPriceBias(lightRule.priceBias),
        requireSet: lightRule.requireSet,
        preferredDiameter: fromDbDiameterBias(lightRule.preferredDiameter),
      },
      vent: {
        reason: ventRule.reason,
        reasonLabels: [...ventRule.reasonLabels],
        preferredKeywords: [...ventRule.preferredKeywords],
        avoidKeywords: [...ventRule.avoidKeywords],
        priceBias: fromDbPriceBias(ventRule.priceBias),
        requireSet: ventRule.requireSet,
        preferredDiameter: fromDbDiameterBias(ventRule.preferredDiameter),
      },
      extras: preset.extraRules.map((rule) => ({
        key: rule.key,
        ...toRuleRecord({
          reason: rule.reason,
          reasonLabels: rule.reasonLabels,
          preferredKeywords: rule.preferredKeywords,
          avoidKeywords: rule.avoidKeywords,
          priceBias: fromDbPriceBias(rule.priceBias),
          requireSet: rule.requireSet,
          preferredDiameter: fromDbDiameterBias(rule.preferredDiameter),
        }),
      })),
    },
  };
}

