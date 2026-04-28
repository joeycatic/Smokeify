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

export const GET = withAdminRoute(
  async () => {
    const presets = await prisma.customizerPreset.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        slotRules: { orderBy: { sortOrder: "asc" } },
        extraRules: { orderBy: { sortOrder: "asc" } },
      },
    });
    return adminJson({ presets });
  },
  {
    scope: "ops.read",
  },
);

export const POST = withAdminRoute(
  async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as PresetBody;
    if (!body.slug?.trim() || !body.title?.trim() || !body.defaultSizeKey?.trim()) {
      return adminJson(
        { error: "slug, title, and defaultSizeKey are required." },
        { status: 400 },
      );
    }

    const preset = await prisma.customizerPreset.create({
      data: {
        slug: body.slug.trim(),
        title: body.title.trim(),
        summary: body.summary?.trim() ?? "",
        description: body.description?.trim() ?? "",
        explainer: body.explainer?.trim() ?? "",
        supportedSizeKeys: body.supportedSizeKeys ?? [],
        defaultSizeKey: body.defaultSizeKey.trim(),
        reasonLabels: body.reasonLabels ?? [],
        isActive: body.isActive !== false,
        slotRules: {
          create: [
            ...(body.slotRules?.size ? [normalizeRule(body.slotRules.size, "SIZE", 0)] : []),
            ...(body.slotRules?.light ? [normalizeRule(body.slotRules.light, "LIGHT", 1)] : []),
            ...(body.slotRules?.vent ? [normalizeRule(body.slotRules.vent, "VENT", 2)] : []),
          ],
        },
        extraRules: {
          create: (body.extraRules ?? []).map((rule, index) => ({
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
        },
      },
      include: {
        slotRules: { orderBy: { sortOrder: "asc" } },
        extraRules: { orderBy: { sortOrder: "asc" } },
      },
    });

    return adminJson({ preset }, { status: 201 });
  },
  {
    scope: "ops.write",
  },
);
