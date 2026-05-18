export type MerchantPolicyViolation = {
  field: string;
  reason: "medical_claim" | "illegal_use_implication";
  match: string;
};

const MEDICAL_CLAIM_PATTERNS: RegExp[] = [
  /\b(cure|cures|cured|treat|treats|treated|treatment|prevent|prevents|prevention|heal|heals|healing|therapy|therapeutic|medical|medicinal|anti[-\s]?inflammatory|pain[-\s]?relief)\b/gi,
  /\b(heil(t|en|ung)?|therapie|therapeutisch|medizinisch|entz[üu]ndungshemmend|schmerzlindernd|schmerzfrei|gegen\s+[a-zäöüß-]+)\b/gi,
];

const ILLEGAL_USE_IMPLICATION_PATTERNS: RegExp[] = [
  /\b(kiffen|joints?|dabbing|stoned|high)\b/gi,
  /\b(for|für|zum|zur)\s+(cannabis|marijuana|weed|kiffen|joints?|dabbing|rauchen|smoking)\b/gi,
  /\b(smoking\s+accessor(y|ies)|drug\s+use|illegal\s+use)\b/gi,
];

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const collectMatches = (value: string, patterns: RegExp[]) => {
  const found = new Set<string>();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of value.matchAll(pattern)) {
      const token = (match[0] ?? "").trim();
      if (!token) continue;
      found.add(token.toLowerCase());
      if (found.size >= 5) break;
    }
  }
  return Array.from(found);
};

export const collectMerchantPolicyViolations = (
  fields: Record<string, string | null | undefined>
): MerchantPolicyViolation[] => {
  const violations: MerchantPolicyViolation[] = [];

  for (const [field, rawValue] of Object.entries(fields)) {
    if (!rawValue) continue;
    const normalized = stripHtml(rawValue);
    if (!normalized) continue;

    const medicalMatches = collectMatches(normalized, MEDICAL_CLAIM_PATTERNS);
    for (const match of medicalMatches) {
      violations.push({
        field,
        reason: "medical_claim",
        match,
      });
    }

    const illegalMatches = collectMatches(
      normalized,
      ILLEGAL_USE_IMPLICATION_PATTERNS
    );
    for (const match of illegalMatches) {
      violations.push({
        field,
        reason: "illegal_use_implication",
        match,
      });
    }
  }

  return violations;
};
