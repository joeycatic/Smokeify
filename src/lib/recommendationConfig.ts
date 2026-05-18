export const RECOMMENDATION_RULE_TRIGGER_OPTIONS = [
  { value: "CATEGORY", label: "Category" },
  { value: "TAG", label: "Tag" },
  { value: "PRODUCT_GROUP", label: "Product group" },
] as const;

export const RECOMMENDATION_RULE_TARGET_OPTIONS = [
  { value: "CATEGORY", label: "Category" },
  { value: "TAG", label: "Tag" },
  { value: "PRODUCT_GROUP", label: "Product group" },
] as const;

export type RecommendationRuleTriggerCode =
  (typeof RECOMMENDATION_RULE_TRIGGER_OPTIONS)[number]["value"];

export type RecommendationRuleTargetCode =
  (typeof RECOMMENDATION_RULE_TARGET_OPTIONS)[number]["value"];

export const RECOMMENDATION_RULE_TRIGGER_SET = new Set<RecommendationRuleTriggerCode>(
  RECOMMENDATION_RULE_TRIGGER_OPTIONS.map((option) => option.value),
);

export const RECOMMENDATION_RULE_TARGET_SET = new Set<RecommendationRuleTargetCode>(
  RECOMMENDATION_RULE_TARGET_OPTIONS.map((option) => option.value),
);

export const RECOMMENDATION_RULE_TRIGGER_LABELS: Record<
  RecommendationRuleTriggerCode,
  string
> = Object.fromEntries(
  RECOMMENDATION_RULE_TRIGGER_OPTIONS.map((option) => [option.value, option.label]),
) as Record<RecommendationRuleTriggerCode, string>;

export const RECOMMENDATION_RULE_TARGET_LABELS: Record<
  RecommendationRuleTargetCode,
  string
> = Object.fromEntries(
  RECOMMENDATION_RULE_TARGET_OPTIONS.map((option) => [option.value, option.label]),
) as Record<RecommendationRuleTargetCode, string>;

export const RECOMMENDATION_REASON_LABELS = {
  manualOverride: "Manual override",
  rule: "Rule match",
  categoryFallback: "Shared category fallback",
  bestsellerFallback: "Catalog fallback",
} as const;
