import { sanitizePlainText } from "@/lib/sanitizeHtml";
import {
  RECOMMENDATION_RULE_TARGET_SET,
  RECOMMENDATION_RULE_TRIGGER_SET,
  type RecommendationRuleTargetCode,
  type RecommendationRuleTriggerCode,
} from "@/lib/recommendationConfig";

export type RecommendationRuleInput = {
  name: string;
  description: string | null;
  triggerType: RecommendationRuleTriggerCode;
  triggerValue: string;
  targetType: RecommendationRuleTargetCode;
  targetValue: string;
  priority: number;
  maxProducts: number | null;
  isActive: boolean;
};

const parseInteger = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed);
    }
  }
  return fallback;
};

const sanitizeUnknownPlainText = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return sanitizePlainText(value)?.trim() ?? "";
};

export function parseRecommendationRuleInput(body: {
  name?: unknown;
  description?: unknown;
  triggerType?: unknown;
  triggerValue?: unknown;
  targetType?: unknown;
  targetValue?: unknown;
  priority?: unknown;
  maxProducts?: unknown;
  isActive?: unknown;
}): { ok: true; value: RecommendationRuleInput } | { ok: false; error: string } {
  const name = sanitizeUnknownPlainText(body.name);
  if (!name) {
    return { ok: false, error: "Rule name is required." };
  }

  const triggerType = String(body.triggerType ?? "").trim().toUpperCase();
  if (!RECOMMENDATION_RULE_TRIGGER_SET.has(triggerType as RecommendationRuleTriggerCode)) {
    return { ok: false, error: "Invalid trigger type." };
  }

  const targetType = String(body.targetType ?? "").trim().toUpperCase();
  if (!RECOMMENDATION_RULE_TARGET_SET.has(targetType as RecommendationRuleTargetCode)) {
    return { ok: false, error: "Invalid target type." };
  }

  const triggerValue = sanitizeUnknownPlainText(body.triggerValue);
  if (!triggerValue) {
    return { ok: false, error: "Trigger value is required." };
  }

  const targetValue = sanitizeUnknownPlainText(body.targetValue);
  if (!targetValue) {
    return { ok: false, error: "Target value is required." };
  }

  const priority = parseInteger(body.priority, 0);
  const maxProductsRaw =
    typeof body.maxProducts === "undefined" || body.maxProducts === null || body.maxProducts === ""
      ? null
      : parseInteger(body.maxProducts, 0);
  if (maxProductsRaw !== null && maxProductsRaw <= 0) {
    return { ok: false, error: "Max products must be empty or a positive number." };
  }

  return {
    ok: true,
    value: {
      name,
      description: sanitizeUnknownPlainText(body.description) || null,
      triggerType: triggerType as RecommendationRuleTriggerCode,
      triggerValue,
      targetType: targetType as RecommendationRuleTargetCode,
      targetValue,
      priority,
      maxProducts: maxProductsRaw,
      isActive: body.isActive !== false,
    },
  };
}
