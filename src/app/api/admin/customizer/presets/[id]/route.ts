import { adminJson } from "@/lib/adminApi";
import { prisma } from "@/lib/prisma";
import { withAdminRoute } from "@/lib/adminRoute";

type PresetRuleInput = {
  reason: string;
  reasonLabels?: string[];
  preferredKeywords?: string[];
  avoidKeywords?: string[];
  priceBias?: "BUDGET" | "BALANCED" | "PREMIUM";
  requireSet?: boolean;
  preferredDiameter?: "SMALLEST" | "LARGEST" | null;
};

type PresetExtraRuleInput = PresetRuleInput & {
  key: string;
};

type PresetBody = {
  slug?: string;
  title?: string;
  summary?: string;
  description?: string;
  explainer?: string;
  supportedSizeKeys?: string[];
  defaultSizeKey?: string;
  reasonLabels?: string[];
  isActive?: boolean;
  slotRules?: {
    size?: PresetRuleInput;
    light?: PresetRuleInput;
    vent?: PresetRuleInput;
  };
  extraRules?: PresetExtraRuleInput[];
};

const normalizeRule = (rule: PresetRuleInput, slot: "SIZE" | "LIGHT" | "VENT", sortOrder: number) => ({
  slot,
  sortOrder,
  reason: rule.reason,
  reasonLabels: rule.reasonLabels ?? [],
  preferredKeywords: rule.preferredKeywords ?? [],
  avoidKeywords: rule.avoidKeywords ?? [],
  priceBias: rule.priceBias ?? "BALANCED",
  requireSet: rule.requireSet === true,
  preferredDiameter: rule.preferredDiameter ?? null,
});

export const PATCH = withAdminRoute(
  async ({ request, params }) => {
    const body = (await request.json().catch(() => ({}))) as PresetBody;

    const preset = await prisma.$transaction(async (tx) => {
      const updated = await tx.customizerPreset.update({
        where: { id: params.id },
        data: {
          slug: typeof body.slug === "string" ? body.slug.trim() : undefined,
          title: typeof body.title === "string" ? body.title.trim() : undefined,
          summary: typeof body.summary === "string" ? body.summary.trim() : undefined,
          description:
            typeof body.description === "string" ? body.description.trim() : undefined,
          explainer: typeof body.explainer === "string" ? body.explainer.trim() : undefined,
          supportedSizeKeys: body.supportedSizeKeys,
          defaultSizeKey:
            typeof body.defaultSizeKey === "string" ? body.defaultSizeKey.trim() : undefined,
          reasonLabels: body.reasonLabels,
          isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        },
      });

      if (body.slotRules) {
        await tx.customizerPresetSlotRule.deleteMany({
          where: { presetId: params.id },
        });
        await tx.customizerPresetSlotRule.createMany({
          data: [
            ...(body.slotRules.size ? [normalizeRule(body.slotRules.size, "SIZE", 0)] : []),
            ...(body.slotRules.light ? [normalizeRule(body.slotRules.light, "LIGHT", 1)] : []),
            ...(body.slotRules.vent ? [normalizeRule(body.slotRules.vent, "VENT", 2)] : []),
          ].map((rule) => ({
            presetId: params.id,
            ...rule,
          })),
        });
      }

      if (body.extraRules) {
        await tx.customizerPresetExtraRule.deleteMany({
          where: { presetId: params.id },
        });
        if (body.extraRules.length > 0) {
          await tx.customizerPresetExtraRule.createMany({
            data: body.extraRules.map((rule, index) => ({
              presetId: params.id,
              key: rule.key,
              sortOrder: index,
              reason: rule.reason,
              reasonLabels: rule.reasonLabels ?? [],
              preferredKeywords: rule.preferredKeywords ?? [],
              avoidKeywords: rule.avoidKeywords ?? [],
              priceBias: rule.priceBias ?? "BALANCED",
              requireSet: rule.requireSet === true,
              preferredDiameter: rule.preferredDiameter ?? null,
            })),
          });
        }
      }

      return tx.customizerPreset.findUnique({
        where: { id: updated.id },
        include: {
          slotRules: { orderBy: { sortOrder: "asc" } },
          extraRules: { orderBy: { sortOrder: "asc" } },
        },
      });
    });

    return adminJson({ preset });
  },
  {
    scope: "ops.write",
  },
);

export const DELETE = withAdminRoute(
  async ({ params }) => {
    await prisma.customizerPreset.delete({
      where: { id: params.id },
    });
    return adminJson({ ok: true });
  },
  {
    scope: "ops.write",
  },
);
